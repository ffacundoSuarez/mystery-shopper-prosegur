import { SurveySection } from '../types';
import { SI_NO_COD, SI_P56, SI_P59 } from './constants';

export const parte2: SurveySection = {
  id: 'parte-2',
  title: 'Parte 2 — Primer recontacto',
  description: 'Seguimiento posterior a la interacción principal (P56–P63).',
  modules: [
    {
      id: 'seguimiento-1',
      title: 'Módulo seguimiento — Primer recontacto',
      questions: [
        {
          id: 'p56-recontacto',
          text: 'P56. ¿Existió un primer recontacto por parte del comercial o de la empresa?',
          type: 'single',
          options: SI_NO_COD,
        },
        {
          id: 'p57-tiempo',
          text: 'P57. ¿En cuánto tiempo ocurrió este primer recontacto?',
          type: 'single',
          options: [
            { value: '1', label: 'Dentro de las primeras 24 horas' },
            { value: '2', label: 'Entre 24 y 48 horas' },
            { value: '3', label: 'Después de 48 horas (3 días o más)' },
          ],
          showIf: SI_P56,
        },
        {
          id: 'p58-ofrecimiento',
          text: 'P58. ¿Cuál fue el ofrecimiento principal o argumento de este recontacto?',
          type: 'longtext',
          showIf: SI_P56,
        },
        {
          id: 'p59-nueva-promo',
          text: 'P59. ¿Se le ofreció alguna nueva promoción, descuento o bonificación respecto a la oferta inicial?',
          type: 'single',
          options: SI_NO_COD,
          showIf: SI_P56,
        },
        {
          id: 'p60-detalle-promo',
          text: 'P60. ¿Cuál? Describa lo que le dijo o escribió el comercial',
          type: 'longtext',
          showIf: { all: [SI_P56, SI_P59] },
        },
        {
          id: 'p61-precio-instalacion',
          text: 'P61. Registrar precio de instalación (paquete económico final)',
          type: 'text',
          showIf: { all: [SI_P56, SI_P59] },
        },
        {
          id: 'p62-precio-abono',
          text: 'P62. Registrar precio de abono mensual (paquete económico final)',
          type: 'text',
          showIf: { all: [SI_P56, SI_P59] },
        },
        {
          id: 'p63-iva',
          text: 'P63. ¿Los valores incluyen impuestos (IVA)?',
          type: 'single',
          options: SI_NO_COD,
          showIf: { all: [SI_P56, SI_P59] },
        },
      ],
    },
  ],
};
