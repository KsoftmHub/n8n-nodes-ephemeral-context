# n8n-nodes-ephemeral-context

[![semantic-release: angular](https://img.shields.io/badge/semantic--release-angular-e10079?logo=semantic-release)](https://github.com/semantic-release/semantic-release)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://badge.fury.io/js/%40ksoftm%2Fn8n-nodes-ephemeral-context.svg)](https://badge.fury.io/js/%40ksoftm%2Fn8n-nodes-ephemeral-context)


A powerful, in-memory "RAM" for n8n workflows. Teleport data between branches, manage counters, and build complex state entirely in memory.

Stop fighting with complex Merge Nodes just to pass data between disconnected branches. This node allows you to store, retrieve, and accumulate data instantly across any part of a workflow execution, or even share data across different workflows.

## 🚀 Key Features

- **Teleport Data**: Set variables in Branch A, read them in Branch B.
- **Global High-Speed Cache**: Share data between separate workflow executions (e.g., API rate limit counters).
- **Advanced State Management**: Atomic counters, Queues (Push/Pop/Shift), and Existence checks.
- **Safety First**: Memory limits to prevent crashes and automatic garbage collection.

## 📦 Operations

### 1. Set Value
Store values in memory.
- **Modes**:
  - `Always Set`: Overwrite or create.
  - `If Not Exists (NX)`: Only set if the key is missing (locks).
  - `If Exists (XX)`: Update only if it already exists.
- **Key**: Supports dot-notation (e.g., `user.details.id`).
- **Value**: String, Number, Boolean, Array, or Object.

### 2. Get / Check / Clear
- **Get Value**: Retrieve a specific value by key.
- **Get All**: Retrieve the entire store for the current scope.
- **Check Exists**: Efficiently check `true/false` if a key exists.
- **Clear**: Remove a specific key or reset the entire scope.

### 3. Atomic Counters
Thread-safe numeric operations.
- **Increment / Decrement**: Modify a number without race conditions. Perfect for counting loops or rate limiting.

### 4. Array Operations
Turn arrays into Queues or Stacks.
- **Push**: Append to end.
- **Unshift**: Prepend to start.
- **Pop**: Remove and return the last item (Stack LIFO).
- **Shift**: Remove and return the first item (Queue FIFO).
- **Remove Item**: Remove a key entirely.

## 🌐 Scopes

Control how long your data lives:

| Scope | Lifetime | Visibility | Use Case |
| :--- | :--- | :--- | :--- |
| **Execution** (Default) | Single Run | Isolated to current run | Passing variables between IF branches |
| **Workflow** | App Lifecycle | Shared by all runs of ONE workflow | Aggregating data across multiple webhook calls |
| **Global** | App Lifecycle | Shared by ALL workflows | Global rate limiters, cross-workflow signals |

> **Note**: All data is stored in **Memory (RAM)**. If you restart your n8n instance, **all data is lost**.

## 💡 Usage Scenarios

### Scenario A: The "Disconnected Branch"
You have an IF node and want to collect data from both branches without complex merges.
- **True Branch**: `Push` ID to `processed_ids`.
- **False Branch**: `Push` ID to `failed_ids`.
- **Finally**: `Get All` to see the full report.

### Scenario B: Global Rate Limiter
Prevent a specific API from being called too often across multiple workflows.
1. **Scope**: `Global`
2. **Operation**: `Increment` key `api_usage_minute`.
3. Checks if `api_usage_minute` > 100 before making the request.

### Scenario C: "Once Processed" Lock
Ensure a resource is only processed once, even if triggered simultaneously.
1. **Operation**: `Set` with mode `If Not Exists (NX)`.
2. **Key**: `lock_resource_123`.
3. If result `success: false`, stop execution.

## ⚠️ Limitations & Safety

1.  **Ephemeral**: Data is lost on n8n restart.
2.  **Memory Limits**:
    *   Maximum 10MB per value.
    *   Maximum 100MB total store size (soft limit).
3.  **Cluster Environments**:
    *   This node uses **Process RAM**.
    *   If you use **Queue Mode** with multiple workers, "Global" and "Workflow" scopes **WILL NOT** sync between servers.
    *   Execution scope works fine as long as the execution stays on one worker (avoid Wait nodes if using Queue Mode).

## 📥 Installation

```bash
npm install @ksoftm/n8n-nodes-ephemeral-context
```

## License

MIT
