/**
 * Hand-built IR sample projects.
 *
 * These serve two purposes: they are executable documentation of the IR
 * shape, and they are the shared fixtures for emitter snapshot tests, so the
 * three emitter packages exercise identical input. They are maintained by
 * hand and must stay in sync with `ir/nodes.ts`.
 */
import { Span } from '../text/span';
import {
  IrDeclaredType,
  IrEnum,
  IrErrorType,
  IrField,
  IrFunction,
  IrModel,
  IrOrigin,
  IrPrimitiveName,
  IrPrimitiveType,
  IrProject,
  IrType,
} from './nodes';

const fixtureSpan: Span = {
  file: 'fixture.ck',
  start: 0,
  end: 0,
  startLine: 1,
  startColumn: 1,
  endLine: 1,
  endColumn: 1,
};

function origin(module: string): IrOrigin {
  return { file: 'fixture.ck', span: fixtureSpan, module };
}

export function primitive(name: IrPrimitiveName): IrPrimitiveType {
  return { kind: 'primitive', name };
}

function field(module: string, name: string, type: IrType, defaultValue?: IrField['defaultValue']): IrField {
  return { name, type, defaultValue, origin: origin(module) };
}

/**
 * A model exercising every primitive, collections, optionals, and a default
 * value, in module `app.models`.
 */
export function sampleKitchenSinkModel(): IrModel {
  const m = 'app.models';
  return {
    kind: 'model',
    name: 'Profile',
    fields: [
      field(m, 'id', primitive('ID')),
      field(m, 'name', primitive('String')),
      field(m, 'email', primitive('Email')),
      field(m, 'age', primitive('Int')),
      field(m, 'rating', primitive('Float')),
      field(m, 'balance', primitive('Decimal')),
      field(m, 'birthday', primitive('Date')),
      field(m, 'createdAt', primitive('DateTime')),
      field(m, 'avatarUrl', { kind: 'optional', inner: primitive('URL') }),
      field(m, 'thumbnail', primitive('Data')),
      field(m, 'tags', { kind: 'set', element: primitive('String') }),
      field(m, 'scores', { kind: 'list', element: primitive('Int') }),
      field(m, 'attributes', { kind: 'map', key: primitive('String'), value: primitive('String') }),
      field(m, 'isActive', primitive('Bool'), {
        kind: 'boolLiteral',
        value: true,
        type: primitive('Bool'),
      }),
    ],
    origin: origin(m),
  };
}

export function sampleSimpleEnum(): IrEnum {
  const m = 'app.models';
  return {
    kind: 'enum',
    name: 'OrderStatus',
    cases: [
      { name: 'pending', fields: [], origin: origin(m) },
      { name: 'shipped', fields: [], origin: origin(m) },
      { name: 'delivered', fields: [], origin: origin(m) },
    ],
    isSimple: true,
    origin: origin(m),
  };
}

export function sampleAssociatedEnum(): IrEnum {
  const m = 'app.models';
  return {
    kind: 'enum',
    name: 'BookingStatus',
    cases: [
      { name: 'pending', fields: [], origin: origin(m) },
      { name: 'confirmed', fields: [], origin: origin(m) },
      { name: 'cancelled', fields: [field(m, 'reason', primitive('String'))], origin: origin(m) },
      { name: 'completed', fields: [], origin: origin(m) },
    ],
    isSimple: false,
    origin: origin(m),
  };
}

export function sampleError(): IrErrorType {
  const m = 'app.models';
  return {
    kind: 'error',
    name: 'AuthError',
    cases: [
      { name: 'invalidCredentials', fields: [], origin: origin(m) },
      { name: 'lockedOut', fields: [field(m, 'until', primitive('DateTime'))], origin: origin(m) },
      { name: 'network', fields: [field(m, 'message', primitive('String'))], origin: origin(m) },
    ],
    isSimple: false,
    origin: origin(m),
  };
}

const greetingType: IrDeclaredType = {
  kind: 'declared',
  name: 'Greeting',
  module: 'app.main',
  declarationKind: 'model',
};

/** The hello-world module: a model plus pure and constructing functions. */
export function sampleHelloWorldModule(): IrProject {
  const m = 'app.main';
  const greeting: IrModel = {
    kind: 'model',
    name: 'Greeting',
    fields: [
      field(m, 'id', primitive('ID')),
      field(m, 'message', primitive('String')),
      field(m, 'isFriendly', primitive('Bool'), {
        kind: 'boolLiteral',
        value: true,
        type: primitive('Bool'),
      }),
    ],
    origin: origin(m),
  };

  const greetingText: IrFunction = {
    kind: 'function',
    name: 'greetingText',
    params: [{ name: 'greeting', type: greetingType, origin: origin(m) }],
    returnType: primitive('String'),
    isAsync: false,
    body: [
      {
        kind: 'return',
        value: {
          kind: 'fieldAccess',
          object: { kind: 'paramRef', name: 'greeting', type: greetingType },
          field: 'message',
          type: primitive('String'),
        },
      },
    ],
    origin: origin(m),
  };

  const friendlyGreeting: IrFunction = {
    kind: 'function',
    name: 'friendlyGreeting',
    params: [{ name: 'message', type: primitive('String'), origin: origin(m) }],
    returnType: greetingType,
    isAsync: false,
    body: [
      {
        kind: 'return',
        value: {
          kind: 'construct',
          model: { name: 'Greeting', module: m },
          args: [
            {
              name: 'id',
              value: { kind: 'stringLiteral', value: 'greeting-1', type: primitive('ID') },
            },
            {
              name: 'message',
              value: { kind: 'paramRef', name: 'message', type: primitive('String') },
            },
          ],
          type: greetingType,
        },
      },
    ],
    origin: origin(m),
  };

  return {
    modules: [
      {
        name: m,
        file: 'src/main.ck',
        declarations: [greeting, greetingText, friendlyGreeting],
      },
    ],
  };
}

/** Functions exercising expressions: binary ops, if/else, let, and calls. */
export function sampleFunctionsModule(): IrProject {
  const m = 'app.text';
  const fullName: IrFunction = {
    kind: 'function',
    name: 'fullName',
    params: [
      { name: 'first', type: primitive('String'), origin: origin(m) },
      { name: 'last', type: primitive('String'), origin: origin(m) },
    ],
    returnType: primitive('String'),
    isAsync: false,
    body: [
      {
        kind: 'return',
        value: {
          kind: 'binary',
          operator: '+',
          left: {
            kind: 'binary',
            operator: '+',
            left: { kind: 'paramRef', name: 'first', type: primitive('String') },
            right: { kind: 'stringLiteral', value: ' ', type: primitive('String') },
            type: primitive('String'),
          },
          right: { kind: 'paramRef', name: 'last', type: primitive('String') },
          type: primitive('String'),
        },
      },
    ],
    origin: origin(m),
  };

  const larger: IrFunction = {
    kind: 'function',
    name: 'larger',
    params: [
      { name: 'a', type: primitive('Int'), origin: origin(m) },
      { name: 'b', type: primitive('Int'), origin: origin(m) },
    ],
    returnType: primitive('Int'),
    isAsync: false,
    body: [
      {
        kind: 'if',
        condition: {
          kind: 'binary',
          operator: '>',
          left: { kind: 'paramRef', name: 'a', type: primitive('Int') },
          right: { kind: 'paramRef', name: 'b', type: primitive('Int') },
          type: primitive('Bool'),
        },
        then: [{ kind: 'return', value: { kind: 'paramRef', name: 'a', type: primitive('Int') } }],
        else: [{ kind: 'return', value: { kind: 'paramRef', name: 'b', type: primitive('Int') } }],
      },
    ],
    origin: origin(m),
  };

  const describeCount: IrFunction = {
    kind: 'function',
    name: 'describeCount',
    params: [{ name: 'count', type: primitive('Int'), origin: origin(m) }],
    returnType: primitive('String'),
    isAsync: false,
    body: [
      {
        kind: 'let',
        name: 'label',
        mutable: false,
        type: primitive('String'),
        value: { kind: 'stringLiteral', value: 'items', type: primitive('String') },
      },
      {
        kind: 'if',
        condition: {
          kind: 'binary',
          operator: '==',
          left: { kind: 'paramRef', name: 'count', type: primitive('Int') },
          right: { kind: 'intLiteral', text: '1', type: primitive('Int') },
          type: primitive('Bool'),
        },
        then: [
          {
            kind: 'return',
            value: { kind: 'stringLiteral', value: '1 item', type: primitive('String') },
          },
        ],
      },
      {
        kind: 'return',
        value: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'stringLiteral', value: 'many ', type: primitive('String') },
          right: { kind: 'localRef', name: 'label', type: primitive('String') },
          type: primitive('String'),
        },
      },
    ],
    origin: origin(m),
  };

  return {
    modules: [
      { name: m, file: 'src/text.ck', declarations: [fullName, larger, describeCount] },
    ],
  };
}

/** An async throws function returning a constructed model. */
export function sampleAsyncModule(): IrProject {
  const m = 'app.net';
  const remoteUser: IrModel = {
    kind: 'model',
    name: 'RemoteUser',
    fields: [field(m, 'id', primitive('ID')), field(m, 'name', primitive('String'))],
    origin: origin(m),
  };
  const networkError: IrErrorType = {
    kind: 'error',
    name: 'NetworkError',
    cases: [
      { name: 'timeout', fields: [], origin: origin(m) },
      { name: 'server', fields: [field(m, 'message', primitive('String'))], origin: origin(m) },
    ],
    isSimple: false,
    origin: origin(m),
  };
  const remoteUserType: IrDeclaredType = {
    kind: 'declared',
    name: 'RemoteUser',
    module: m,
    declarationKind: 'model',
  };
  const fetchUser: IrFunction = {
    kind: 'function',
    name: 'fetchUser',
    params: [{ name: 'id', type: primitive('ID'), origin: origin(m) }],
    returnType: remoteUserType,
    isAsync: true,
    throwsType: { kind: 'declared', name: 'NetworkError', module: m, declarationKind: 'error' },
    body: [
      {
        kind: 'return',
        value: {
          kind: 'construct',
          model: { name: 'RemoteUser', module: m },
          args: [
            { name: 'id', value: { kind: 'paramRef', name: 'id', type: primitive('ID') } },
            {
              name: 'name',
              value: { kind: 'stringLiteral', value: 'Remote', type: primitive('String') },
            },
          ],
          type: remoteUserType,
        },
      },
    ],
    origin: origin(m),
  };

  return {
    modules: [{ name: m, file: 'src/net.ck', declarations: [remoteUser, networkError, fetchUser] }],
  };
}

/** Two modules where `app.api` references a model from `app.models`. */
export function sampleCrossModuleProject(): IrProject {
  const models = 'app.models';
  const api = 'app.api';
  const user: IrModel = {
    kind: 'model',
    name: 'User',
    fields: [field(models, 'id', primitive('ID')), field(models, 'name', primitive('String'))],
    origin: origin(models),
  };
  const userType: IrDeclaredType = {
    kind: 'declared',
    name: 'User',
    module: models,
    declarationKind: 'model',
  };
  const welcome: IrFunction = {
    kind: 'function',
    name: 'welcome',
    params: [{ name: 'user', type: userType, origin: origin(api) }],
    returnType: primitive('String'),
    isAsync: false,
    body: [
      {
        kind: 'return',
        value: {
          kind: 'binary',
          operator: '+',
          left: { kind: 'stringLiteral', value: 'Welcome, ', type: primitive('String') },
          right: {
            kind: 'fieldAccess',
            object: { kind: 'paramRef', name: 'user', type: userType },
            field: 'name',
            type: primitive('String'),
          },
          type: primitive('String'),
        },
      },
    ],
    origin: origin(api),
  };

  return {
    modules: [
      { name: models, file: 'src/models.ck', declarations: [user] },
      { name: api, file: 'src/api.ck', declarations: [welcome] },
    ],
  };
}

/** A single project bundling the kitchen-sink model, enums, and error. */
export function sampleTypesProject(): IrProject {
  return {
    modules: [
      {
        name: 'app.models',
        file: 'src/models.ck',
        declarations: [
          sampleKitchenSinkModel(),
          sampleSimpleEnum(),
          sampleAssociatedEnum(),
          sampleError(),
        ],
      },
    ],
  };
}
