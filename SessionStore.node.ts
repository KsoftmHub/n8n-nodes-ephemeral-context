import {
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';

// Interface for our storage object
interface ISessionData {
  [executionId: string]: {
    data: any;
    timestamp: number; // Added to track when this session was last touched
  };
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
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Set Value',
            value: 'set',
            description: 'Store a value by key (supports dot.notation)',
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
            name: 'Push to Array',
            value: 'push',
            description: 'Append a value to an array',
          },
          {
            name: 'Clear',
            value: 'clear',
            description: 'Remove a specific key or reset the entire session',
          },
        ],
        default: 'set',
      },
      // ----------------------------------
      // Operation: SET / GET / PUSH / CLEAR (Key)
      // ----------------------------------
      {
        displayName: 'Key',
        name: 'key',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['set', 'get', 'push', 'clear'],
          },
          hide: {
            operation: ['clear'],
            scope: ['all'],
          },
        },
        description: 'The key to store/retrieve. Supports dot-notation (e.g. "user.profile.name").',
      },
      // ----------------------------------
      // Operation: CLEAR (Scope)
      // ----------------------------------
      {
        displayName: 'Scope',
        name: 'scope',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['clear'],
          },
        },
        options: [
          {
            name: 'Specific Key',
            value: 'key',
          },
          {
            name: 'All (Reset Session)',
            value: 'all',
          },
        ],
        default: 'key',
        description: 'Whether to clear a specific key or the entire session memory',
      },
      // ----------------------------------
      // Operation: SET / PUSH (Value)
      // ----------------------------------
      {
        displayName: 'Value Type',
        name: 'valueType',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['set', 'push'],
          },
        },
        options: [
          { name: 'String', value: 'string' },
          { name: 'Number', value: 'number' },
          { name: 'Boolean', value: 'boolean' },
          { name: 'JSON / Object', value: 'json' },
          { name: 'Expression', value: 'expression' },
        ],
        default: 'string',
        description: 'The type of data you want to store',
      },
      {
        displayName: 'Value',
        name: 'value',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['set', 'push'],
            valueType: ['string', 'expression'],
          },
        },
        default: '',
        description: 'The value to store',
      },
      {
        displayName: 'Value',
        name: 'value',
        type: 'number',
        displayOptions: {
          show: {
            operation: ['set', 'push'],
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
            operation: ['set', 'push'],
            valueType: ['boolean'],
          },
        },
        default: false,
      },
      {
        displayName: 'Value (JSON)',
        name: 'value',
        type: 'json',
        displayOptions: {
          show: {
            operation: ['set', 'push'],
            valueType: ['json'],
          },
        },
        default: '{}',
      },
    ],
  };

  // --------------------------------------------------------------------------
  // In-Memory Storage & Garbage Collection Config
  // --------------------------------------------------------------------------
  private static sessionStore: ISessionData = {};

  // How long (in ms) data should survive in RAM before being considered "stale".
  // 1 Hour = 3600000 ms.
  // This prevents memory leaks if a workflow errors out before clearing itself.
  private static readonly TTL_MS = 3600000;

  private static runGarbageCollection() {
    const now = Date.now();
    const keys = Object.keys(SessionStore.sessionStore);

    // Only run GC if there are actually items, to save CPU
    if (keys.length === 0) return;

    keys.forEach(execId => {
      const entry = SessionStore.sessionStore[execId];
      if (now - entry.timestamp > SessionStore.TTL_MS) {
        delete SessionStore.sessionStore[execId];
      }
    });
  }

  // Helper: Set value using dot notation
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

  // Helper: Get value using dot notation
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

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const executionId = this.getExecutionId();

    // 1. Run Garbage Collection occasionally (e.g. 1% chance or every run)
    // Since this is light, we can run it every time or wrap in a Math.random check
    SessionStore.runGarbageCollection();

    // 2. Initialize or Update Timestamp
    if (!SessionStore.sessionStore[executionId]) {
      SessionStore.sessionStore[executionId] = {
        data: {},
        timestamp: Date.now()
      };
    } else {
      // Update timestamp to keep session alive
      SessionStore.sessionStore[executionId].timestamp = Date.now();
    }

    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const sessionRef = SessionStore.sessionStore[executionId].data;
        let result: any = {};

        if (operation === 'set' || operation === 'push') {
          const key = this.getNodeParameter('key', i) as string;
          const valueType = this.getNodeParameter('valueType', i) as string;
          let value = this.getNodeParameter('value', i) as any;

          if (valueType === 'json' && typeof value === 'string') {
            try { value = JSON.parse(value); } catch (e) { }
          }

          if (operation === 'set') {
            SessionStore.setDeep(sessionRef, key, value);
            result = { success: true, key, value, op: 'set' };
          } else if (operation === 'push') {
            const currentArray = SessionStore.getDeep(sessionRef, key);
            if (Array.isArray(currentArray)) {
              currentArray.push(value);
              result = { success: true, key, newLength: currentArray.length, op: 'push' };
            } else if (currentArray === undefined) {
              SessionStore.setDeep(sessionRef, key, [value]);
              result = { success: true, key, newLength: 1, op: 'push (created)' };
            } else {
              throw new NodeOperationError(this.getNode(), `Key "${key}" exists but is not an array.`);
            }
          }
        } else if (operation === 'get') {
          const key = this.getNodeParameter('key', i) as string;
          const value = SessionStore.getDeep(sessionRef, key);

          if (typeof value === 'object' && value !== null) {
            result = value;
          } else {
            result = { [key.split('.').pop()!]: value };
          }

        } else if (operation === 'getAll') {
          result = sessionRef;

        } else if (operation === 'clear') {
          const scope = this.getNodeParameter('scope', i) as string;

          if (scope === 'all') {
            SessionStore.sessionStore[executionId].data = {};
            result = { success: true, op: 'clear_all' };
          } else {
            const key = this.getNodeParameter('key', i) as string;
            if (key.includes('.')) {
              SessionStore.setDeep(sessionRef, key, undefined);
            } else {
              delete sessionRef[key];
            }
            result = { success: true, key, op: 'clear_key' };
          }
        }

        returnData.push({ json: result });

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
