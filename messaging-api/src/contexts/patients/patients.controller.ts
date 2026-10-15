import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { MAX_CSV_BYTES, PatientsService } from './patients.service';
import { ListPatientsDto } from './dto/list-patients.dto';

@ApiTags('patients')
@Controller('patients')
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Post('import')
  @ApiOperation({
    summary: 'Importa até 1000 pacientes de um CSV UTF-8 de até 1 MiB',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_CSV_BYTES, files: 1, fields: 0 },
      fileFilter: (_request, file, callback) => {
        const accepted =
          /\.csv$/i.test(file.originalname) &&
          [
            'text/csv',
            'application/csv',
            'application/vnd.ms-excel',
            'text/plain',
            'application/octet-stream',
          ].includes(file.mimetype);
        callback(
          accepted ? null : new BadRequestException('Envie um arquivo .csv.'),
          accepted,
        );
      },
    }),
  )
  import(@UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('O campo file é obrigatório.');
    return this.patients.importCsv(file.buffer);
  }

  @Get()
  findAll(@Query() query: ListPatientsDto) {
    return this.patients.findAll(query);
  }
}
