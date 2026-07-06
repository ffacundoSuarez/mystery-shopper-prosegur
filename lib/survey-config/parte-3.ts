import { SurveySection } from '../types';
import { SI_NO_COD, SI_P64, SI_P67, evidenciasModule } from './constants';

export const parte3: SurveySection = {
  id: 'parte-3',
  title: 'Parte 3 — Segundo recontacto',
  titlePt: 'Parte 3 — Segundo recontacto',
  description: 'Segundo seguimiento posterior a la interacción principal (P64–P71).',
  descriptionPt: 'Segundo acompanhamento posterior à interação principal (P64–P71).',
  modules: [
    {
      id: 'seguimiento-2',
      title: 'Módulo seguimiento — Segundo recontacto',
      titlePt: 'Módulo de acompanhamento — Segundo recontacto',
      questions: [
        {
          id: 'p64-segundo-recontacto',
          text: 'P64. ¿Existió un segundo recontacto por parte del comercial o de la empresa tras la interacción principal?',
          textPt: 'P64. Existiu um segundo recontacto por parte do comercial ou da empresa após a interação principal?',
          type: 'single',
          options: SI_NO_COD,
        },
        {
          id: 'p65-tiempo',
          text: 'P65. ¿En cuánto tiempo ocurrió este recontacto?',
          textPt: 'P65. Em quanto tempo ocorreu este recontacto?',
          type: 'single',
          options: [
            { value: '1', label: 'Dentro de las primeras 24 horas (un día)', labelPt: 'Nas primeiras 24 horas (um dia)' },
            { value: '2', label: 'Entre las 24 y las 48 horas (dos días)', labelPt: 'Entre as 24 e as 48 horas (dois dias)' },
            { value: '3', label: 'Después de las 48 horas (3 días o más)', labelPt: 'Após as 48 horas (3 dias ou mais)' },
          ],
          showIf: SI_P64,
        },
        {
          id: 'p66-ofrecimiento',
          text: 'P66. ¿Cuál fue el ofrecimiento principal o argumento de este recontacto? Describa lo qué le dijo o escribió el comercial:',
          textPt: 'P66. Qual foi a oferta principal ou argumento deste recontacto? Descreva o que lhe disse ou escreveu o comercial:',
          type: 'longtext',
          showIf: SI_P64,
        },
        {
          id: 'p67-nueva-promo-2',
          text: 'P67. ¿Se le ofreció alguna nueva promoción, descuento, bonificación o cambio respecto a la oferta inicial?',
          textPt: 'P67. Foi-lhe oferecida alguma nova promoção, desconto, bonificação ou alteração em relação à oferta inicial?',
          type: 'single',
          options: SI_NO_COD,
          showIf: SI_P64,
        },
        {
          id: 'p68-detalle-promo',
          text: 'P68. ¿Cuál? Describa lo qué le dijo o escribió el comercial',
          textPt: 'P68. Qual? Descreva o que lhe disse ou escreveu o comercial',
          type: 'longtext',
          showIf: { all: [SI_P64, SI_P67] },
        },
        {
          id: 'p69-precio-instalacion',
          text: 'P69. Registrar precio de instalación:',
          textPt: 'P69. Registar preço de instalação:',
          type: 'number',
          hint: 'Detalle del paquete económico final ofrecido en este segundo contacto.',
          hintPt: 'Detalhe do pacote económico final oferecido neste segundo contacto.',
          showIf: { all: [SI_P64, SI_P67] },
        },
        {
          id: 'p70-precio-abono',
          text: 'P70. Registrar precio de abono mensual:',
          textPt: 'P70. Registar preço de mensalidade:',
          type: 'number',
          showIf: { all: [SI_P64, SI_P67] },
        },
        {
          id: 'p71-iva',
          text: 'P71. ¿Los valores incluyen impuestos (IVA)?',
          textPt: 'P71. Os valores incluem impostos (IVA)?',
          type: 'single',
          options: SI_NO_COD,
          showIf: { all: [SI_P64, SI_P67] },
        },
      ],
    },
    evidenciasModule(3),
  ],
};
