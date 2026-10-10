import { AfterViewInit, Directive, ElementRef, inject } from '@angular/core';

/** Foca o elemento assim que ele aparece na tela. */
@Directive({ selector: '[appAutofocus]' })
export class AutofocusDirective implements AfterViewInit {
  private el = inject<ElementRef<HTMLElement>>(ElementRef);

  ngAfterViewInit() {
    setTimeout(() => this.el.nativeElement.focus());
  }
}
