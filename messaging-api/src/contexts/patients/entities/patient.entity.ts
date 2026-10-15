import {
  Column,
  Check,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';

@Entity('patients')
@Unique('UQ_patients_phone', ['phone'])
@Unique('UQ_patients_email', ['email'])
@Check('CHK_patients_contact', '"phone" IS NOT NULL OR "email" IS NOT NULL')
export class Patient {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
