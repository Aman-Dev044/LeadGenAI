import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpsertCredentialDto {
  /**
   * Field key -> value. A blank secret means "keep whatever is stored"; the
   * literal `__clear__` removes one. The shape is validated per provider in the
   * service, against that provider's declared fields.
   */
  @IsOptional()
  @IsObject()
  values?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
