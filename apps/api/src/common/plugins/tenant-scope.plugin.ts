import { AsyncLocalStorage } from 'async_hooks';
import { Schema } from 'mongoose';

interface TenantStore {
  tenantId: string;
}

export const tenantContext = new AsyncLocalStorage<TenantStore>();

export function tenantScopePlugin(schema: Schema): void {
  // Add tenantId to schema if not already present
  if (!schema.path('tenantId')) {
    schema.add({
      tenantId: {
        type: String,
        required: true,
        index: true,
      },
    });
  }

  // Auto-inject tenantId on save
  schema.pre('save', function (next) {
    if (!this.tenantId) {
      const store = tenantContext.getStore();
      if (store?.tenantId) {
        this.tenantId = store.tenantId;
      }
    }
    next();
  });

  // Auto-inject tenantId on insertMany
  schema.pre('insertMany', function (next, docs: any[]) {
    const store = tenantContext.getStore();
    if (store?.tenantId) {
      for (const doc of docs) {
        if (!doc.tenantId) {
          doc.tenantId = store.tenantId;
        }
      }
    }
    next();
  });

  // Auto-scope all queries by tenantId
  const queryMiddleware = function (this: any, next: () => void) {
    const store = tenantContext.getStore();
    if (store?.tenantId && !this.getFilter().tenantId) {
      this.where({ tenantId: store.tenantId });
    }
    next();
  };

  schema.pre('find', queryMiddleware);
  schema.pre('findOne', queryMiddleware);
  schema.pre('findOneAndUpdate', queryMiddleware);
  schema.pre('findOneAndDelete', queryMiddleware);
  schema.pre('countDocuments', queryMiddleware);
  schema.pre('updateOne', queryMiddleware);
  schema.pre('updateMany', queryMiddleware);
  schema.pre('deleteOne', queryMiddleware);
  schema.pre('deleteMany', queryMiddleware);

  // Auto-scope aggregation pipelines
  schema.pre('aggregate', function (next) {
    const store = tenantContext.getStore();
    if (store?.tenantId) {
      this.pipeline().unshift({ $match: { tenantId: store.tenantId } });
    }
    next();
  });
}
