import { IsIn, IsString } from 'class-validator';

export class AssignRoleDto {
  @IsString() roleCode: string;
  @IsIn(['add', 'remove']) action: 'add' | 'remove';
}
