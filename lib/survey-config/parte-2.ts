import { SurveySection } from '../types';
import { SI_NO_COD, SI_P56, SI_P59, evidenciasModule } from './constants';

export const parte2: SurveySection = {
  id: 'parte-2',
  title: 'Parte 2 — Primer recontacto',
  titlePt: 'Parte 2 — Primeiro recontacto',
  description: 'Seguimiento posterior a la interacción principal (P56–P63).',
  descriptionPt: 'Acompanhamento posterior à interação principal (P56–P63).',
  modules: [
    {
      id: 'seguimiento-1',
      title: 'Módulo seguimiento — Primer recontacto',
      titlePt: 'Módulo de acompanhamento — Primeiro recontacto',
      questions: [
        {
          id: 'p56-recontacto',
          text: 'P56. ¿Existió un primer recontacto por parte del comercial o de la empresa tras la interacción principal?',
          textPt: 'P56. Existiu um primeiro recontacto por parte do comercial ou da empresa após a interação principal?',
          type: 'single',
          options: SI_NO_COD,
        },
        {
          id: 'p57-tiempo',
          text: 'P57. ¿En cuánto tiempo ocurrió este primer recontacto?',
          textPt: 'P57. Em quanto tempo ocorreu este primeiro recontacto?',
          type: 'single',
          options: [
            { value: '1', label: 'Dentro de las primeras 24 horas (un día)', labelPt: 'Nas primeiras 24 horas (um dia)' },
            { value: '2', label: 'Entre las 24 y las 48 horas (dos días)', labelPt: 'Entre as 24 e as 48 horas (dois dias)' },
            { value: '3', label: 'Después de las 48 horas (3 días o más)', labelPt: 'Após as 48 horas (3 dias ou mais)' },
          ],
          showIf: SI_P56,
        },
        {
          id: 'p58-ofrecimiento',
          text: 'P58. ¿Cuál fue el ofrecimiento principal o argumento de este recontacto? Describa lo qué le dijo o escribió el comercial:',
          textPt: 'P58. Qual foi a oferta principal ou argumento deste recontacto? Descreva o que lhe disse ou escreveu o comercial:',
          type: 'longtext',
          showIf: SI_P56,
        },
        {
          id: 'p59-nueva-promo',
          text: 'P59. ¿Se le ofreció alguna nueva promoción, descuento, bonificación o cambio respecto a la oferta inicial?',
          textPt: 'P59. Foi-lhe oferecida alguma nova promoção, desconto, bonificação ou alteração em relação à oferta inicial?',
          type: 'single',
          options: SI_NO_COD,
          showIf: SI_P56,
        },
        {
          id: 'p60-detalle-promo',
          text: 'P60. ¿Cuál? Describa lo qué le dijo o escribió el comercial',
          textPt: 'P60. Qual? Descreva o que lhe disse ou escreveu o comercial',
          type: 'longtext',
          showIf: { all: [SI_P56, SI_P59] },
        },
        {
          id: 'p61-precio-instalacion',
          text: 'P61. Registrar precio de instalación:',
          textPt: 'P61. Registar preço de instalação:',
          type: 'number',
          hint: 'Detalle del paquete económico final ofrecido en este segundo contacto.',
          hintPt: 'Detalhe do pacote económico final oferecido neste segundo contacto.',
          showIf: { all: [SI_P56, SI_P59] },
        },
        {
          id: 'p62-precio-abono',
          text: 'P62. Registrar precio de abono mensual:',
          textPt: 'P62. Registar preço de mensalidade:',
          type: 'number',
          showIf: { all: [SI_P56, SI_P59] },
        },
        {
          id: 'p63-iva',
          text: 'P63. ¿Los valores incluyen impuestos (IVA)?',
          textPt: 'P63. Os valores incluem impostos (IVA)?',
          type: 'single',
          options: SI_NO_COD,
          showIf: { all: [SI_P56, SI_P59] },
        },
      ],
    },
    evidenciasModule(2),
  ],
};
