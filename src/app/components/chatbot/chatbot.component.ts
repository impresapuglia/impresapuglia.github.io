import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  templateUrl: './chatbot.component.html',
})
export class ChatbotComponent {
  /** Attenzione il componente è stato creato ma non è funzionante o collegato a nessuna AI attualmente. */
  @Input() aperto = false;
  @Output() chiudi = new EventEmitter<void>();
}
