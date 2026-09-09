import { Model, FilterQuery, SortOrder } from 'mongoose';
import { PaginationDto, PaginatedResult } from '../dto/pagination.dto';

const ALLOWED_SORT_FIELDS = new Set([
  'createdAt', 'updatedAt', 'name', 'email', 'status', 'score',
  'firstName', 'lastName', 'type', 'priority', 'lastActivityAt',
  'temperature', 'source', 'startTime', 'endTime', 'scheduledAt',
]);

export async function paginate<T>(
  model: Model<T>,
  query: FilterQuery<T>,
  paginationDto: PaginationDto,
  populate?: string | string[],
): Promise<PaginatedResult<T>> {
  const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = paginationDto;
  const skip = (page - 1) * limit;

  const safeSortBy = ALLOWED_SORT_FIELDS.has(sortBy) ? sortBy : 'createdAt';
  const sort: Record<string, SortOrder> = { [safeSortBy]: sortOrder === 'asc' ? 1 : -1 };

  let queryBuilder = model.find(query).sort(sort).skip(skip).limit(limit);

  if (populate) {
    const fields = Array.isArray(populate) ? populate : [populate];
    for (const field of fields) {
      queryBuilder = queryBuilder.populate(field);
    }
  }

  const [data, total] = await Promise.all([
    queryBuilder.lean().exec(),
    model.countDocuments(query).exec(),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    data: data as T[],
    total,
    totalPages,
    page,
    limit,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}
