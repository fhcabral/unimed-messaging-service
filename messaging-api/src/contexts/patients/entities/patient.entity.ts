import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('patients')
@Unique('UQ_patients_phone', ['phone'])
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 16 })
  phone: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
