4. PHASE 1 — An agent onboards itself (register → magazine → quarantine gate)
This happens when an agent process starts (the Gateway launches it, or you run run.sh directly).

Step 1 — the agent announces itself. awcp_kit.mount() runs _setup_otel() then self-registers: POST /agents/register (or /agents/announce) to the radar, declaring name, kind, framework, risk, telemetry_enabled, feature_flags, policy_callbacks, control_endpoint. Handled at radar/api.py:1013 register() / api.py:1059 announce(), creating an AgentEntry in the in-memory REGISTRY.

Step 2 — onboarding runs as a Temporal workflow. _onboarding_manager (or announce directly) starts AgentOnboardingWorkflow on the agent-radar-onboarding queue. It is 4 activities, each a named step you can watch in the Temporal UI (onboarding.py workflow):


map_identity → quarantine_check → link_mcp → admit
map_identity (onboarding.py:17) normalizes owner/runtime/version and loads awcp_magazine.json — the central policy file. The magazine is ground truth: it overrides whatever the agent claimed, setting its risk, token_budget, and write_scopes by name. An agent not listed gets __default__ = risk: high, token_budget: 500, write_scopes: [] (fail-closed). This is "the registry checks the policy."

quarantine_check (onboarding.py:49 decide_status) is the admission gate. An agent stays quarantined until it has all three control hooks:

telemetry — observed, not just declared
feature flags — declared and observed in execution
policy callbacks — declared and the agent has actually called the gate
This is the closed-loop trick: declaring a hook isn't trusted. The flags AGENT_RADAR_REQUIRE_OBSERVED_* mean the agent must prove the hook by actually emitting telemetry / calling the gate. Until then it's quarantined — and a quarantined agent is blocked from every governed write (policy.py:198).

Step 3 — auto-promotion. Once the agent runs and emits a real execution event or calls the gate, _observe_telemetry / _observe_policy / _observe_flags flip the proven flags on and re-run decide_status — so the agent leaves quarantine to active automatically. The reverse also happens: _telemetry_reconciler re-quarantines an agent whose telemetry goes silent past a TTL.

If Temporal is down, all of this still happens inline (_onboard_inline) — the same logic, just not durable.

5. PHASE 2 — The radar discovers agents on its own
Independently of self-registration, a background scanner thread (scanner.py, every 30 s) runs scan_all() (psutil-based detectors/) to find running agent frameworks / MCP servers / LLM runtimes, and reconciles them into the registry. This is why the system catches autonomous agents that never politely register — it sees the process. That matters for token enforcement (Phase 7, layer 3).

6. PHASE 3 — You submit a prompt
React UI → POST /user/submit {agent, input} on the Gateway.
_ensure_up resolves the agent from the bundle folder (agents_fs.discover scans for run.sh), checks if it's running (pgrep + lsof to find its real listening port, never assumed), and auto-starts it if needed (fs.start → bash run.sh with AGENT_RADAR_URL + OTEL_EXPORTER_OTLP_ENDPOINT injected into the child env, so the agent reports back to this gateway).
It fetches the agent's /info to get its radar agent_id, then POST {agent}/tasks {goal} (_submit_task). The agent queues the task and returns a task id.
The Gateway returns task_id, workflow_id = task-{agent_id}-{task_id}, and a deep link to the Temporal UI. The UI then polls GET /user/status/... for the live timeline.
7. PHASE 4 — The agent runs the task (and every step becomes a Temporal activity)
Inside the agent, awcp_kit._worker_loop (kit:1161) picks up the task:

Opens an OTel span agent.task.run.
Starts the execution workflow: POST /tasks/execution/start → radar api.py:1353 starts AgentExecutionWorkflow on the agent-task-execution queue.
Runs run_goal() (the framework-specific agent — e.g. a LangGraph ReAct agent), emitting one event per step: llm_called, web_search, tool_called, synthesize → each is POST /tasks/execution/{task_id}/event.
How a step becomes a Temporal activity (the clever, dynamic part):
The radar forwards each event as a push_event signal to the running workflow. The workflow (execution.py) keeps a generic loop that maps event.type → a different activity function (_EVENT_TO_ACTIVITY) and executes it. So every logical step the agent takes shows up as its own named activity in the Temporal UI — with no hardcoded call sequence. Add a new step type and it just appears. The activities themselves (activities/execution.py) are thin: execution_setup, execution_llm_call, execution_tool_call, etc.

How a tool call works (the write-action firewall):
Agents do not run tools locally. kit.call_tool → mcp_execute opens an SSE connection to the MCP server and calls its execute_tool (mcp/server.py:341). The MCP server is the firewall:

It resolves the tool's risk/scope.
For a write, it calls back to the radar gate POST /agents/{agent_id}/gate (_radar_gate) before running the tool.
The radar gate() evaluates: token hard-stop? quarantined? scope allowed? where on the autonomy ladder? (policy.evaluate_action) and returns allow/deny.
Only on allow does the MCP server run the tool — the one and only place tools execute. High-risk writes (e.g. external_post) also require operator approval: the task pauses (awaiting_approval), and POST /user/approve/{agent}/{task_id} (user.py:365) resolves it.
LLM calls: the agent calls Ollama (:11434) — either directly (kit captures token counts via httpx hooks) or through the /llm proxy (Phase 7).

Completes: POST /tasks/execution/{task_id}/complete → finish signal → execution_complete activity → the workflow ends.
8. PHASE 5 — How traces are generated and where OTel collects them
Every process calls setup_otel(service_name) (observability/setup.py:39) exactly once at startup. That wires three OTel providers (Traces, Metrics, Logs) all exporting OTLP over gRPC to :4317 (the Collector):

Gateway → service awcp-gateway (and it calls instrument_fastapi + instrument_requests, so every HTTP route in and out is auto-traced — app.py:77).
Radar → awcp-radar; MCP server → awcp-mcp-server; each agent → awcp-agent-<framework>.
Trace stitching across services: when the agent calls the MCP server, it passes a W3C traceparent (trace_context). The MCP server's execute_tool opens its tool span as a child of that context (_govern_span). So in Tempo you see one connected trace: agent task → MCP tool → gate decision.

The Collector (otel-collector-config.yaml) fans out three pipelines:


traces  → Tempo
metrics → Prometheus
logs    → Loki
Grafana (:3000, admin/awcp1234) reads all three for the dashboards.

9. PHASE 6 — How Laminar counts tokens (the monitoring half)
The radar forwards every /tasks/execution/* payload to the laminar package before Temporal handling, so token accounting works even if Temporal is down. The wiring is just three injected hooks (radar/api.py:937-975) — laminar never imports the radar.

For each event, bridge.on_execution_event:

Extracts tokens taxonomy-free — any event carrying input_tokens/prompt_tokens/gen_ai.usage.input_tokens (in extra or top-level) counts; others are ignored (_extract_tokens).
Records to the ledger (ledger.py): a per-agent sliding window (default 1 hour, _acct ring) used for budget decisions + lifetime totals for dashboards + optional durable JSONL evidence. Cost is computed from a prefix-matched price table (0.0 for local Ollama — honest).
Emits one OTel span laminar.token.usage carrying gen_ai.* attributes (_emit_usage_span) → goes to the Collector (Tempo/Grafana) and dual-exports to the Laminar dashboard (:5667) so it renders native token/cost/model views. It also stamps the trace_id back onto the ledger record for deep-linking.
Evaluates the budget (budget.evaluate): used / budget → ok (<warn), warn (≥ warn ratio), exhausted (≥ budget). The budget is resolved by precedence: operator override → declared token_budget (from the magazine) → risk tier → system default — nothing hardcoded.
The window means an idle agent recovers automatically as old records age out.

10. PHASE 7 — When the token budget is full: how it BLOCKS (5 layers)
This is the heart of "if tokens full, how it blocks more." There are five coexisting enforcement layers, each catching a different agent topology:

Layer 1 — Graceful degradation (durable). On the upward crossing into exhausted (or warn if LMNR_ENFORCE_AT_WARN), _handle_transition fires the injected on_breach exactly once → radar's _on_token_breach steps the agent one rung down its autonomy ladder (active → trace_boost → throttled → safe_profile → recommendation_only → suspended, policy.py:38). From recommendation_only onward, the existing write-action gate denies writes. One mechanism, two inputs (failures and tokens).

Layer 2 — Live hard stop (gate-level). _token_blocked is checked at the gate, at execution-start, and on every mid-flight event. While over budget it denies ALL actions (even reads), refuses to start a new execution, and signals an in-flight workflow to finish(blocked) (api.py:1442-1464). The agent doesn't get a vote. This lifts automatically when the window clears.

Layer 3 — Process hard stop (for autonomous agents). An agent running its own loop never asks the gate — so the radar acts on the process it scanned. _token_process_reconciler (off the event loop, every 10 s) SIGSTOPs the over-budget agent's local process (or pushes a suspend to its remote control_endpoint), and SIGCONTs it when the budget recovers. There's a crash-recovery journal (FREEZE_JOURNAL) so a killed radar doesn't leave processes frozen forever, and shared processes are never frozen (that would silence co-tenant agents).

Layer 5 — Token-aware LLM gateway (/llm). The hardest wall (radar/llm_gateway.py). If an agent points its model base URL at <gateway>/llm, every call is metered and gated at the source:

Over budget → HTTP 429, the call is never forwarded — physically can't spend another token (proxy).
Pre-check: it estimates input tokens from the request body (estimator.py, tiktoken with a chars÷4 fallback) and denies the call before any tokens are spent if the projection would exhaust the budget (pre_check). An _inflight reservation makes this concurrency-safe.
Everything is fail-open: a control-plane error never bricks model traffic.
All five are keyed only on agent_id/pid with budgets resolved positionally — so they cover any agent, existing or registered at runtime, with nothing hardcoded.

11. PHASE 8 — The live timeline back to the UI
The UI polls GET /user/status/{agent}/{task_id}?workflow_id=... (user.py:328). _extract_timeline reads the Temporal workflow history back and folds the scheduled activities into an ordered step list — setup → llm_call → web_search → tool_call → synthesize → complete — merged with the agent's own task record (result, tools_used, awaiting-approval). So the timeline reflects whatever the agent actually did, reconstructed from Temporal's durable history, not a hardcoded script. The token bar comes from /laminar/usage.

12. Quick "how is X connected to Y" reference
Question	Answer
How does the UI reach everything on one port?	Gateway mounts the radar router at root + /user/* + /laminar/* + /llm/* (app.py)
How does an agent get onboarded?	self-register/announce → AgentOnboardingWorkflow (map→quarantine→link→admit) → magazine sets ground-truth policy
Why is a new agent blocked from writing?	quarantine_check keeps it quarantined until telemetry/flags/policy hooks are observed, not just declared
How is the MCP server called?	agent call_tool → SSE → execute_tool (the only place tools run)
How is the radar gate called?	the MCP server calls POST /agents/{id}/gate before any write tool
Where does Temporal work?	two in-process workers (onboarding queue + execution queue) started by the radar lifespan; every agent step = one activity via push_event signals
How are traces generated?	every process setup_otel() → OTLP :4317; W3C traceparent stitches agent→MCP→tool into one trace
Where does OTel collect?	Collector :4317 → Tempo (traces) / Prometheus (metrics) / Loki (logs) → Grafana
How are tokens counted?	radar taps every execution event → laminar ledger (sliding window) + laminar.token.usage span → Laminar :5667
How does it block when full?	5 layers: ladder-degrade → gate hard-stop → SIGSTOP process → remote suspend → /llm 429 + pre-check
This is the whole loop: discover → onboard (policy + quarantine gate) → run (each step a Temporal activity) → tools through the MCP firewall (gate) → count tokens (Laminar) → block when over budget (5 layers) → trace everything (OTel) → replay the timeline to the UI.

Want me to save this as docs/ARCHITECTURE.md in the repo so it lives alongside the code, and/or generate a rendered diagram (Mermaid) version you can paste into a viewer?