# n8n-nodes-ephemeral-context

A lightweight, in-memory "RAM" for n8n workflows.

Stop fighting with complex Merge Nodes just to pass data between disconnected branches. This node allows you to store, retrieve, and accumulate data instantly across any part of a workflow execution, without external databases like Redis.

## 🚀 Why do I need this?

In n8n, data flows downstream like a river. If you split your workflow into Branch A and Branch B, they cannot see each other's data. To combine them, you normally have to use complex Merge nodes.

With Ephemeral Context, you can:

- **Teleport Data**: Set a variable in Branch A, read it in Branch B.
- **Simplify Loops**: Accumulate items (like `success_count` or `error_list`) inside a loop without complex "Previous Node" references.
- **AI Memory**: Build a "Context Window" for AI Agents by pushing thoughts to an array in the background, then reading the full history at the end.

## 📦 Operations

### 1. Set Value

Stores a value in the current execution's memory.

- **Key**: Supports dot-notation (e.g., `user.details.id`). It will automatically create the nested objects `user` and `details` if they don't exist.
- **Value**: String, Number, Boolean, or JSON.

### 2. Get Value

Retrieves a specific value.

- **Key**: e.g., `user.details.id`.
- **Returns**: The specific value found.

### 3. Push to Array (The Loop Saver)

Appends a value to an array. If the array doesn't exist, it creates it.

- **Use Case**: Perfect for logging errors inside a SplitInBatches loop.
- **Example**: Push `{"email": "bad@email.com", "error": "404"}` to key `failed_imports`.

### 4. Get All

Retrieves the entire session object for the current execution.

- **Use Case**: Pass this entire object to an LLM (ChatGPT/Claude) as "Context" or "Memory".

### 5. Clear

- **Scope**: Clear a specific key or Reset All to free up memory.

## 💡 Usage Scenarios

### Scenario A: The "Disconnected Branch" Problem

You have an IF node. You want to count how many items went to True vs False, but you don't want to merge the branches immediately.

- **True Branch**: Node Session Store -> Operation: Push -> Key: `processed_ids` -> Value: `{{$json.id}}`.
- **False Branch**: Node Session Store -> Operation: Push -> Key: `failed_ids` -> Value: `{{$json.id}}`.
- **End of Workflow**: Node Session Store -> Operation: Get All.
- **Output**: `{ "processed_ids": [1, 2], "failed_ids": [3] }`

### Scenario B: AI Agent "Inner Monologue"

You are building a ReAct-style agent that performs Google Searches before answering.

- **Init**: Set `thoughts = []`.
- **Agent Step 1**: "I need to search for the weather." -> Push to `thoughts`.
- **Agent Step 2**: Perform HTTP Request. -> Push result to `thoughts`.
- **Final Step**: Get `thoughts` and send to LLM to summarize the answer.

## ⚠️ Important Architectural Limitations

This node uses Process RAM (Global Scope). It is designed for speed and simplicity, but you must understand the limitations:

- **It is Ephemeral**: If you restart your n8n instance, all data is lost. Do not use this for long-term storage (use a Database node for that).
- **Queue Mode & Wait Nodes**:
    - If you run n8n in Queue Mode (Scaling mode with Workers) AND you use a Wait Node (e.g., "Wait for Webhook"), the execution might resume on a different server.
    - Since this data is stored in the RAM of Server A, if the workflow wakes up on Server B, the memory will be empty.
    - **Rule of Thumb**: Only use this node for workflows that run continuously from start to finish. Avoid using it across "Wait" nodes in clustered environments.

## 🛠 Technical Details

- **Isolation**: Data is keyed by `executionId`. Workflow A cannot read Workflow B's data.
- **Garbage Collection**: To prevent memory leaks, the node includes an automatic Garbage Collector. Session data is strictly typed to expire after 1 hour (configurable in source) of inactivity.

## 📥 Installation

Copy the `dist` folder to your n8n custom nodes directory or install via npm if published:

```bash
npm install @ksoftm/n8n-nodes-ephemeral-context
```

## License

MIT
