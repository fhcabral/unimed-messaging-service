import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../../common/pagination.dto';
import { MessagesService } from './messages.service';
import { SendMessagesDto } from './dto/send-messages.dto';

@ApiTags('messages')
@Controller('messages')
export class MessagesController {
  constructor(private readonly messages: MessagesService) {}

  @Post('send')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Envia para até 100 pacientes por canal: SMS mock e/ou e-mail SMTP real. SENT indica aceite do provider, não entrega. Sem channels, mantém SMS legado.',
  })
  send(@Body() dto: SendMessagesDto) {
    return this.messages.send(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.messages.findAll(query);
  }
}
