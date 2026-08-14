declare module 'vue' {
  interface GlobalDirectives {
    permission: { resource: string; action: string }
  }
}

export {}
