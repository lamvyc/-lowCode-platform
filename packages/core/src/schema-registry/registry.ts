import type {
  ApiSchema,
  DataModelSchema,
  ProcessSchema,
  SchemaEnvelope,
} from '@lowcode/schema'

/**
 * 数据源取数时解析 DataModel/API 引用的最小接口。
 * DataSourceManager 依赖此接口而非具体注册表，便于测试与替换后端实现。
 */
export interface SchemaRefResolver {
  resolveDataModel(id: string): DataModelSchema | undefined
  resolveApi(id: string): ApiSchema | undefined
}

/**
 * 五层 Schema 注册表：前端的「Schema 数据库」。
 * 按 metadata.id 索引 DataModel / API / Process 信封，供页面取数与流程编排解析 ref。
 * Page / Plugin 由运行时与插件管理器各自消费，不在此索引。
 */
export class SchemaRegistry implements SchemaRefResolver {
  private dataModels = new Map<string, DataModelSchema>()
  private apis = new Map<string, ApiSchema>()
  private processes = new Map<string, ProcessSchema>()

  register(schema: SchemaEnvelope): void {
    switch (schema.kind) {
      case 'DataModel':
        this.dataModels.set(schema.metadata.id, schema as DataModelSchema)
        return
      case 'API':
        this.apis.set(schema.metadata.id, schema as ApiSchema)
        return
      case 'Process':
        this.processes.set(schema.metadata.id, schema as ProcessSchema)
        return
      case 'Page':
      case 'Plugin':
        return
    }
  }

  registerMany(schemas: SchemaEnvelope[]): void {
    for (const schema of schemas) this.register(schema)
  }

  resolveDataModel(id: string): DataModelSchema | undefined {
    return this.dataModels.get(id)
  }

  resolveApi(id: string): ApiSchema | undefined {
    return this.apis.get(id)
  }

  getProcess(id: string): ProcessSchema | undefined {
    return this.processes.get(id)
  }

  listDataModels(): DataModelSchema[] {
    return [...this.dataModels.values()]
  }

  listApis(): ApiSchema[] {
    return [...this.apis.values()]
  }

  listProcesses(): ProcessSchema[] {
    return [...this.processes.values()]
  }
}
