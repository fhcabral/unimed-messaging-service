import { Body, Controller, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/pagination.dto';
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
      'Simula envios para até 100 pacientes; SENT significa aceite pelo mock, sem entrega real',
  })
  send(@Body() dto: SendMessagesDto) {
    return this.messages.send(dto);
  }

  @Get()
  findAll(@Query() query: PaginationDto) {
    return this.messages.findAll(query);
  }
}
