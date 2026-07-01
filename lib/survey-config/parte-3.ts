import { SurveySection } from '../types';
import { SI_NO_COD, SI_P64, SI_P67 } from './constants';

export const parte3: SurveySection = {
  id: 'parte-3',
  title: 'Parte 3 — Segundo recontacto',
  description: 'Segundo seguimiento posterior a la interacción principal (P64–P71).',
  modules: [
    {
      id: 'seguimiento-2',
      title: 'Módulo seguimiento — Segundo recontacto',
      questions: [
        {
          id: 'p64-segundo-recontacto',
          text: 'P64. ¿Existió un segundo recontacto por parte del comercial o de la empresa?',
          type: 'single',
          options: SI_NO_COD,
        },
        {
          id: 'p65-tiempo',
          text: 'P65. ¿En cuánto tiempo ocurrió este recontacto?',
          type: 'single',
          options: [
            { value: '1', label: 'Dentro de las primeras 24 horas' },
            { value: '2', label: 'Entre 24 y 48 horas' },
            { value: '3', label: 'Después de 48 horas (3 días o más)' },
          ],
          showIf: SI_P64,
        },
        {
          id: 'p66-ofrecimiento',
          text: 'P66. ¿Cuál fue el ofrecimiento principal o argumento de este recontacto?',
          type: 'longtext',
          showIf: SI_P64,
        },
        {
          id: 'p67-nueva-promo-2',
          text: 'P67. ¿Se le ofreció alguna nueva promoción, descuento o bonificación respecto a la oferta inicial?',
          type: 'single',
          options: SI_NO_COD,
          showIf: SI_P64,
        },
        {
          id: 'p68-detalle-promo',
          text: 'P68. ¿Cuál? Describa lo que le dijo o escribió el comercial',
          type: 'longtext',
          showIf: { all: [SI_P64, SI_P67] },
        },
        {
          id: 'p69-precio-instalacion',
          text: 'P69. Registrar precio de instalación (paquete económico final)',
          type: 'text',
          showIf: { all: [SI_P64, SI_P67] },
        },
        {
          id: 'p70-precio-abono',
          text: 'P70. Registrar precio de abono mensual (paquete económico final)',
          type: 'text',
          showIf: { all: [SI_P64, SI_P67] },
        },
        {
          id: 'p71-iva',
          text: 'P71. ¿Los valores incluyen impuestos (IVA)?',
          type: 'single',
          options: SI_NO_COD,
          showIf: { all: [SI_P64, SI_P67] },
        },
      ],
    },
  ],
};
