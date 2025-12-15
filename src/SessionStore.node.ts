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
    timestamp: number;
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
      // Operation: SET (Multiple Values)
      // ----------------------------------
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
      // Operation: GET / PUSH / CLEAR (Single Key)
      // ----------------------------------
      {
        displayName: 'Key',
        name: 'key',
        type: 'string',
        default: '',
        required: true,
        displayOptions: {
          show: {
            operation: ['get', 'push', 'clear'],
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
      // Operation: PUSH (Single Value)
      // ----------------------------------
      {
        displayName: 'Value Type',
        name: 'valueType',
        type: 'options',
        displayOptions: {
          show: {
            operation: ['push'],
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
        description: 'The type of data you want to store',
      },
      {
        displayName: 'Value',
        name: 'value',
        type: 'string',
        displayOptions: {
          show: {
            operation: ['push'],
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
            operation: ['push'],
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
            operation: ['push'],
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
            operation: ['push'],
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
            operation: ['push'],
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
  private static sessionStore: ISessionData = {};
  private static readonly TTL_MS = 3600000; // 1 Hour

  private static runGarbageCollection() {
    const now = Date.now();
    const keys = Object.keys(SessionStore.sessionStore);
    if (keys.length === 0) return;
    keys.forEach(execId => {
      const entry = SessionStore.sessionStore[execId];
      if (now - entry.timestamp > SessionStore.TTL_MS) {
        delete SessionStore.sessionStore[execId];
      }
    });
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

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];
    const executionId = this.getExecutionId();

    SessionStore.runGarbageCollection();

    if (!SessionStore.sessionStore[executionId]) {
      SessionStore.sessionStore[executionId] = {
        data: {},
        timestamp: Date.now()
      };
    } else {
      SessionStore.sessionStore[executionId].timestamp = Date.now();
    }

    const operation = this.getNodeParameter('operation', 0) as string;

    for (let i = 0; i < items.length; i++) {
      try {
        const sessionRef = SessionStore.sessionStore[executionId].data;
        let result: any = {};

        if (operation === 'set') {
          // Handle Multiple Sets via Fixed Collection
          const assignments = this.getNodeParameter('assignments', i) as { values: any[] };
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

              SessionStore.setDeep(sessionRef, key, finalValue);
              setResults[key] = finalValue;
            }
          }
          result = { success: true, op: 'set', updates: setResults };

        } else if (operation === 'push') {
          // Push handles single values to arrays
          const key = this.getNodeParameter('key', i) as string;
          const valueType = this.getNodeParameter('valueType', i) as string;
          let value = this.getNodeParameter('value', i) as any;

          if ((valueType === 'array' || valueType === 'object') && typeof value === 'string') {
            try { value = JSON.parse(value); } catch (e) { }
          }

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
