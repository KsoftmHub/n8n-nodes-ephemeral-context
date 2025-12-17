import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

// Interface for storage entries
interface IStoreEntry {
  data: any;
  timestamp: number;
}

// Interface for collection of stores (execution/workflow scopes)
interface IStoreCollection {
  [id: string]: IStoreEntry;
}

export class SessionStore implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Session Store (Ephemeral)',
    name: 'sessionStore',
    icon: 'fa:memory',
    group: ['transform'],
    version: 1,
    description: 'Store and retrieve data from in-memory session during a workflow execution',
    defaults: {
      name: 'Session Store',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Scope',
        name: 'scope',
        type: 'options',
        options: [
          {
            name: 'Execution (Current Run Only)',
            value: 'execution',
            description: 'Data is isolated to the current execution (default)',
          },
          {
            name: 'Workflow (Shared Across Executions)',
            value: 'workflow',
            description: 'Data is shared across all executions of this workflow (in-memory only)',
          },
          {
            name: 'Global (All Workflows)',
            value: 'global',
            description: 'Data is shared globally across the entire n8n instance (in-memory only)',
          },
        ],
        default: 'execution',
        description: 'The scope of the storage. Data is always ephemeral and lost on restart.',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Set Value(s)',
            value: 'set',
            description: 'Store multiple values by key (supports dot.notation)',
          },
          {
            name: 'Get Value',
            value: 'get',
            description: 'Retrieve a value by key',
          },
          {
            name: 'Get All',
            value: 'getAll',
            description: 'Retrieve the entire session object',
          },
          {
            name: 'Check Exists',
            value: 'exists',
            description: 'Check if a specific key exists',
          },
          {
            name: 'Increment',
            value: 'increment',
            description: 'Atomically increase a numeric value',
          },
          {
            name: 'Decrement',
            value: 'decrement',
            description: 'Atomically decrease a numeric value',
          },
          {
            name: 'Push to Array',
            value: 'push',
            description: 'Append a value to an array',
          },
          {
            name: 'Pop from Array',
            value: 'pop',
            description: 'Remove and return the last element of an array',
          },
          {
            name: 'Shift from Array',
            value: 'shift',
            description: 'Remove and return the first element of an array',
          },
          {
            name: 'Unshift to Array',
            value: 'unshift',
            description: 'Add a value to the beginning of an array',
          },
          {
            name: 'Remove Item',
            value: 'remove',
            description: 'Remove an item from an array or delete a key',
          },
          {
            name: 'Clear',
            value: 'clear',
            description: 'Clear a specific scope',
          },
        ],
        default: 'set',
      },

      // ----------------------------------
      // Operation: SET
      // ----------------------------------
      {
        displayName: 'Set Mode',
        name: 'setMode',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['set'],
          },
        },
        options: [
          {
            name: 'Always Set',
            value: 'auto',
            description: 'Overwrite if exists, create if not',
          },
          {
            name: 'Set If Not Exists (NX)',
            value: 'nx',
            description: 'Only set if the key does not already exist',
          },
          {
            name: 'Set If Exists (XX)',
            value: 'xx',
            description: 'Only set if the key already exists',
          },
        ],
        default: 'auto',
      },
      {
        displayName: 'Values to Set',
        name: 'assignments',
        type: 'fixedCollection',
        typeOptions: {
          multipleValues: true,
        },
        displayOptions: {
          show: {
            operation: ['set'],
          },
        },
        default: {},
        options: [
          {
            name: 'values',
            displayName: 'Values',
            values: [
              {
                displayName: 'Key',
                name: 'key',
                type: 'string',
                default: '',
                description: 'Key to set (e.g. user.name)',
              },
              {
                displayName: 'Type',
                name: 'type',
                type: 'options',
                options: [
                  { name: 'String', value: 'string' },
                  { name: 'Number', value: 'number' },
                  { name: 'Boolean', value: 'boolean' },
                  { name: 'Array', value: 'array' },
                  { name: 'Object', value: 'object' },
                ],
                default: 'string',
              },
              {
                displayName: 'Value',
                name: 'valueString',
                type: 'string',
                displayOptions: {
                  show: { type: ['string'] },
                },
                default: '',
              },
              {
                displayName: 'Value',
                name: 'valueNumber',
                type: 'number',
                displayOptions: {
                  show: { type: ['number'] },
                },
                default: 0,
              },
              {
                displayName: 'Value',
                name: 'valueBoolean',
                type: 'boolean',
                displayOptions: {
                  show: { type: ['boolean'] },
                },
                default: false,
              },
              {
                displayName: 'Value (Array)',
                name: 'valueArray',
                type: 'json',
                displayOptions: {
                  show: { type: ['array'] },
                },
                default: '[]',
                description: 'Enter an array (e.g. ["a", "b"])',
              },
              {
                displayName: 'Value (Object)',
                name: 'valueObject',
                type: 'json',
                displayOptions: {
                  show: { type: ['object'] },
                },
                default: '{}',
                description: 'Enter a JSON object (e.g. {"a": 1})',
              },
            ],
          },
        ],
      },

      // ----------------------------------
      // Clear Specifics
      // ----------------------------------
      {
        displayName: 'Target',
        name: 'clearTarget',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['clear'],
          },
        },
        options: [
          { name: 'Specific Key', value: 'key' },
          { name: 'Entire Scope', value: 'all' },
        ],
        default: 'key',
      },

      // ----------------------------------
      // Common Key Param (Get, Increment, Decrement, Exists, Arrays)
      // ----------------------------------
      {
        displayName: 'Key',
        name: 'key',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: [
              'get', 'exists',
              'increment', 'decrement',
              'push', 'pop', 'shift', 'unshift',
              'remove', 'clear'
            ],
          },
          hide: {
            operation: ['clear'],
            clearTarget: ['all'],
          },
        },
        description: 'The key to target. Supports dot-notation.',
      },

      // ----------------------------------
      // Increment / Decrement
      // ----------------------------------
      {
        displayName: 'Amount',
        name: 'amount',
        type: 'number',
        default: 1,
        displayOptions: {
          show: {
            operation: ['increment', 'decrement'],
          },
        },
        description: 'Amount to increment or decrement by',
      },

      // ----------------------------------
      // Push / Unshift (Single Value)
      // ----------------------------------
      {
        displayName: 'Value Type',
        name: 'valueType',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['push', 'unshift'],
          },
        },
        options: [
          { name: 'String', value: 'string' },
          { name: 'Number', value: 'number' },
          { name: 'Boolean', value: 'boolean' },
          { name: 'Array', value: 'array' },
          { name: 'Object', value: 'object' },
        ],
        default: 'string',
      },
      {
        displayName: 'Value',
        name: 'value',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['push', 'unshift'],
            valueType: ['string'],
          },
        },
        default: '',
      },
      {
        displayName: 'Value',
        name: 'value',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['push', 'unshift'],
            valueType: ['number'],
          },
        },
        default: 0,
      },
      {
        displayName: 'Value',
        name: 'value',
        type: 'boolean',
        displayOptions: {
          show: {
            operation: ['push', 'unshift'],
            valueType: ['boolean'],
          },
        },
        default: false,
      },
      {
        displayName: 'Value (Array)',
        name: 'value',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['push', 'unshift'],
            valueType: ['array'],
          },
        },
        default: '[]',
      },
      {
        displayName: 'Value (Object)',
        name: 'value',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['push', 'unshift'],
            valueType: ['object'],
          },
        },
        default: '{}',
      },
    ],
  };

  // --------------------------------------------------------------------------
  // In-Memory Storage & Garbage Collection Config
  // --------------------------------------------------------------------------
  private static executionStore: IStoreCollection = {};
  private static workflowStore: IStoreCollection = {};
  private static globalStore: IStoreEntry = { data: {}, timestamp: Date.now() };

  private static readonly TTL_MS = 3600000; // 1 Hour for execution/workflow cleanup
  private static readonly MAX_VALUE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
  private static readonly MAX_STORE_SIZE_BYTES = 100 * 1024 * 1024; // 100MB

  private static runGarbageCollection() {
    const now = Date.now();
    // Cleanup Execution Store
    Object.keys(SessionStore.executionStore).forEach(id => {
      if (now - SessionStore.executionStore[id].timestamp > SessionStore.TTL_MS) {
        delete SessionStore.executionStore[id];
      }
    });
    // Cleanup Workflow Store
    Object.keys(SessionStore.workflowStore).forEach(id => {
      if (now - SessionStore.workflowStore[id].timestamp > SessionStore.TTL_MS) {
        delete SessionStore.workflowStore[id];
      }
    });
  }

  private static validateSize(value: any, key: string) {
    const size = JSON.stringify(value).length;
    if (size > SessionStore.MAX_VALUE_SIZE_BYTES) {
      throw new Error(`Value for "${key}" exceeds size limit of ${SessionStore.MAX_VALUE_SIZE_BYTES / 1024 / 1024}MB`);
    }
  }

  private static setDeep(obj: any, path: string, value: any) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!current[key] || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    current[keys[keys.length - 1]] = value;
  }

  private static getDeep(obj: any, path: string, defaultValue: any = undefined) {
    const keys = path.split('.');
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }
    return current === undefined ? defaultValue : current;
  }

  private static deleteDeep(obj: any, path: string) {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current = obj;
    for (const key of keys) {
      if (current === undefined || current === null || typeof current !== 'object') {
        return; // Path doesn't exist
      }
      current = current[key];
    }
    if (current && typeof current === 'object') {
      delete current[lastKey];
    }
  }

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const executionId = this.getExecutionId();

    let workflowId = 'unknown';
    try {
      // @ts-ignore
      workflowId = this.getWorkflow().id || 'unknown';
    } catch (e) { }

    SessionStore.runGarbageCollection();

    const scope = this.getNodeParameter('scope', 0) as string;
    const operation = this.getNodeParameter('operation', 0) as string;

    let targetStoreEntry: IStoreEntry;

    if (scope === 'global') {
      targetStoreEntry = SessionStore.globalStore;
    } else if (scope === 'workflow') {
      if (!SessionStore.workflowStore[workflowId]) {
        SessionStore.workflowStore[workflowId] = { data: {}, timestamp: Date.now() };
      }
      targetStoreEntry = SessionStore.workflowStore[workflowId];
    } else {
      // Execution scope (default)
      if (!SessionStore.executionStore[executionId]) {
        SessionStore.executionStore[executionId] = { data: {}, timestamp: Date.now() };
      }
      targetStoreEntry = SessionStore.executionStore[executionId];
    }

    targetStoreEntry.timestamp = Date.now();
    const sessionRef = targetStoreEntry.data;


    for (let i = 0; i < items.length; i++) {
      try {
        let result: any = {};

        // ----------------------------------
        // SET
        // ----------------------------------
        if (operation === 'set') {
          const assignments = this.getNodeParameter('assignments', i) as { values: any[] };
          const setMode = this.getNodeParameter('setMode', i) as string;
          const setResults: any = {};

          if (assignments && assignments.values) {
            for (const item of assignments.values) {
              const key = item.key;
              const type = item.type;
              let finalValue;

              if (type === 'string') finalValue = item.valueString;
              else if (type === 'number') finalValue = item.valueNumber;
              else if (type === 'boolean') finalValue = item.valueBoolean;
              else if (type === 'array') {
                finalValue = typeof item.valueArray === 'string' ? JSON.parse(item.valueArray) : item.valueArray;
              }
              else if (type === 'object') {
                finalValue = typeof item.valueObject === 'string' ? JSON.parse(item.valueObject) : item.valueObject;
              }

              SessionStore.validateSize(finalValue, key);

              const exists = SessionStore.getDeep(sessionRef, key) !== undefined;

              let shouldSet = false;
              if (setMode === 'auto') shouldSet = true;
              else if (setMode === 'nx' && !exists) shouldSet = true;
              else if (setMode === 'xx' && exists) shouldSet = true;

              if (shouldSet) {
                SessionStore.setDeep(sessionRef, key, finalValue);
                setResults[key] = finalValue;
              }
            }
          }
          result = { success: true, op: 'set', updates: setResults };
        }

        // ----------------------------------
        // GET
        // ----------------------------------
        else if (operation === 'get') {
          const key = this.getNodeParameter('key', i) as string;
          const value = SessionStore.getDeep(sessionRef, key);
          if (typeof value === 'object' && value !== null) {
            result = value;
          } else {
            result = { [key.split('.').pop()!]: value };
          }
        }
        // ----------------------------------
        // EXISTS
        // ----------------------------------
        else if (operation === 'exists') {
          const key = this.getNodeParameter('key', i) as string;
          // Use keys that might generally return undefined to mean not found
          const value = SessionStore.getDeep(sessionRef, key);
          // However, if the key is deep and parent doesn't exist, getDeep returns undefined.
          // If the key exists but value IS undefined (unlikely in JSON?), it's effectively not there.
          result = { key, exists: value !== undefined };
        }

        // ----------------------------------
        // GET ALL
        // ----------------------------------
        else if (operation === 'getAll') {
          result = sessionRef;
        }

        // ----------------------------------
        // NUMERIC ATOMIC
        // ----------------------------------
        else if (operation === 'increment' || operation === 'decrement') {
          const key = this.getNodeParameter('key', i) as string;
          const amount = this.getNodeParameter('amount', i) as number;

          let currentVal = SessionStore.getDeep(sessionRef, key, 0);
          if (typeof currentVal !== 'number') currentVal = 0;

          const newVal = operation === 'increment' ? currentVal + amount : currentVal - amount;
          SessionStore.setDeep(sessionRef, key, newVal);

          result = { key, oldValue: currentVal, newValue: newVal, op: operation };
        }

        // ----------------------------------
        // ARRAY OPERATIONS
        // ----------------------------------
        else if (['push', 'unshift'].includes(operation)) {
          const key = this.getNodeParameter('key', i) as string;
          const valueType = this.getNodeParameter('valueType', i) as string;
          let value = this.getNodeParameter('value', i) as any;

          if ((valueType === 'array' || valueType === 'object') && typeof value === 'string') {
            try { value = JSON.parse(value); } catch (e) { }
          }

          let arr = SessionStore.getDeep(sessionRef, key);
          if (arr === undefined) arr = [];
          if (!Array.isArray(arr)) throw new NodeOperationError(this.getNode(), `Key "${key}" is not an array`);

          SessionStore.validateSize(value, key);

          if (operation === 'push') arr.push(value);
          else arr.unshift(value);

          SessionStore.setDeep(sessionRef, key, arr);
          result = { success: true, key, length: arr.length, op: operation };
        }
        else if (['pop', 'shift'].includes(operation)) {
          const key = this.getNodeParameter('key', i) as string;
          let arr = SessionStore.getDeep(sessionRef, key);
          if (!Array.isArray(arr)) throw new NodeOperationError(this.getNode(), `Key "${key}" is not an array or does not exist`);

          const item = operation === 'pop' ? arr.pop() : arr.shift();
          result = { success: true, key, value: item, length: arr.length, op: operation };
        }
        else if (operation === 'remove') {
          const key = this.getNodeParameter('key', i) as string;
          SessionStore.deleteDeep(sessionRef, key);
          result = { success: true, key, op: 'remove' };
        }

        // ----------------------------------
        // CLEAR
        // ----------------------------------
        else if (operation === 'clear') {
          const clearTarget = this.getNodeParameter('clearTarget', i) as string;

          if (clearTarget === 'all') {
            targetStoreEntry.data = {};
            result = { success: true, op: 'clear_all', scope };
          } else {
            const key = this.getNodeParameter('key', i) as string;
            if (key) {
              SessionStore.deleteDeep(sessionRef, key);
              result = { success: true, key, op: 'clear_key' };
            }
          }
        }

        returnData.push({
          json: result,
          binary: items[i].binary,
        });

      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({ json: { error: (error as Error).message } });
          continue;
        }
        throw error;
      }
    }

    return [returnData];
  }
}
