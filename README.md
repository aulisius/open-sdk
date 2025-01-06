# OpenSDK Generator

A flexible SDK generator that creates type-safe API client libraries from OpenAPI 3.x specifications.

## Features

- Generates client libraries from OpenAPI 3.x specifications
- Supports multiple programming languages:
  - TypeScript
  - Java
  - PHP
- Creates type-safe interfaces and models
- Generates service classes for API operations
- Handles proper file organization and dependencies

## Installation

```bash
npm install @faizaanceg/open-sdk
```

## Usage

```bash
open-sdk generate --spec api-spec.json --language typescript --output ./sdk
```

### CLI Options

- `--spec` (-S): Path to your OpenAPI specification file
- `--language` (-L): Target programming language (typescript, java, or php)
- `--output` (-o): Output directory for the generated SDK
- `--dry-run`: Preview generated files without writing to disk

## Generated SDK Structure

The generated SDK typically includes:

```
sdk/
├── resources/           # Generated interfaces and models
│   └── opensdk-http-client.ts
├── services/           # Service classes for API operations
└── client.ts           # Main entry point
```

## HTTP Client Interface

The generated SDK requires an HTTP client implementation that conforms to the `OpenSDKHttpClient` interface:

```typescript
interface OpenSDKHttpClient {
  execute(
    method: string,
    path: string,
    query: Record<string, any> | null,
    body: Record<string, any> | null
  ): Promise<any>;
}
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Copyright 2025 N Md Faizaan

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
