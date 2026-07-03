import { Condition, ConditionClause, QuestionOption, SurveyModule } from '../types';

/**
 * Crea el módulo de evidencias que se muestra al final de cada parte.
 * Permite adjuntar cualquier archivo (audios, imágenes, videos, PDF, etc.).
 * Es opcional: no bloquea el envío de la parte a revisión.
 * @param parte Número de parte (1, 2 o 3) para generar IDs únicos.
 */
export function evidenciasModule(parte: number): SurveyModule {
  return {
    id: `evidencias-p${parte}`,
    title: 'Evidencias',
    titlePt: 'Evidências',
    description:
      'Adjunte aquí las evidencias de esta parte. Puede subir audios, imágenes, videos, PDF, capturas de pantalla, etc. (opcional).',
    descriptionPt:
      'Anexe aqui as evidências desta parte. Pode enviar áudios, imagens, vídeos, PDF, capturas de ecrã, etc. (opcional).',
    questions: [
      {
        id: `evidencia-parte-${parte}`,
        text: 'Adjuntar evidencias',
        textPt: 'Anexar evidências',
        type: 'evidence',
        hint: 'Audios, imágenes, videos, PDF y cualquier otro archivo.',
        hintPt: 'Áudios, imagens, vídeos, PDF e qualquer outro ficheiro.',
      },
    ],
  };
}

export const SI_NO: QuestionOption[] = [
  { value: 'si', label: 'Sí', labelPt: 'Sim' },
  { value: 'no', label: 'No', labelPt: 'Não' },
];

export const SI_NO_COD: QuestionOption[] = [
  { value: '1', label: 'Sí', labelPt: 'Sim' },
  { value: '2', label: 'No', labelPt: 'Não' },
];

export const PAISES: QuestionOption[] = [
  { value: '1', label: 'Argentina', labelPt: 'Argentina' },
  { value: '2', label: 'Colombia', labelPt: 'Colombia' },
  { value: '3', label: 'Perú', labelPt: 'Perú' },
  { value: '4', label: 'Chile', labelPt: 'Chile' },
  { value: '5', label: 'Paraguay', labelPt: 'Paraguay' },
  { value: '6', label: 'Uruguay', labelPt: 'Uruguay' },
  { value: '7', label: 'Portugal', labelPt: 'Portugal' },
  { value: '8', label: 'Alemania', labelPt: 'Alemania' },
];

/** Condición: país = código(s) */
export function pais(...codes: string[]): ConditionClause {
  return { questionId: 'f1-pais', values: codes };
}

function regionOptions(cityLabel: string, extra: QuestionOption[] = []): QuestionOption[] {
  return [
    { value: 'principal', label: cityLabel, labelPt: cityLabel },
    { value: 'otro', label: 'Otro', labelPt: 'Outro' },
    ...extra,
  ];
}

export const REGION_ARG = regionOptions('AMBA (Gran Buenos Aires & CABA)');
export const REGION_COL = regionOptions('Bogotá');
export const REGION_PER = regionOptions('Lima');
export const REGION_CHI = regionOptions('Santiago');
export const REGION_PRY = regionOptions('Asunción');
export const REGION_URY = regionOptions('Montevideo');
export const REGION_POR = regionOptions('Lisboa');
export const REGION_DEU: QuestionOption[] = [
  { value: 'essen', label: 'Essen', labelPt: 'Essen' },
  { value: 'dortmund', label: 'Dortmund', labelPt: 'Dortmund' },
  { value: 'dusseldorf', label: 'Düsseldorf', labelPt: 'Düsseldorf' },
  { value: 'colonia', label: 'Colonia', labelPt: 'Colonia' },
  { value: 'berlin', label: 'Berlin', labelPt: 'Berlin' },
  { value: 'munich', label: 'Munich', labelPt: 'Munich' },
  { value: 'otro', label: 'Otro', labelPt: 'Outro' },
];

/** Marcas F3 filtradas por país (rotate en la pregunta) */
export const MARCAS: QuestionOption[] = [
  { value: '1', label: 'ADT', labelPt: 'ADT', showIf: pais('1', '2', '3') },
  { value: '2', label: 'Verisure', labelPt: 'Verisure', showIf: pais('1', '2', '3', '4') },
  { value: '3', label: 'Telesentinel', labelPt: 'Telesentinel', showIf: pais('1') },
  { value: '4', label: 'Alarmar', labelPt: 'Alarmar', showIf: pais('1') },
  { value: '5', label: 'Atlas', labelPt: 'Atlas', showIf: pais('1') },
  { value: '6', label: 'Securitas', labelPt: 'Securitas', showIf: pais('1') },
  { value: '7', label: 'Protek', labelPt: 'Protek', showIf: pais('1') },
  { value: '8', label: 'Nos Securitas', labelPt: 'Nos Securitas', showIf: pais('1') },
  { value: '9', label: 'Securitas Direct – Verisure', labelPt: 'Securitas Direct – Verisure', showIf: pais('1') },
  { value: '10', label: 'Maxima', labelPt: 'Maxima', showIf: pais('1') },
  { value: '11', label: 'Prosegur', labelPt: 'Prosegur', showIf: pais('1', '2', '3', '4', '5', '6', '7', '8') },
  { value: '12', label: 'Secu24', labelPt: 'Secu24', showIf: pais('1') },
  {
    value: '13',
    label: 'Otra (especificar)',
    labelPt: 'Outra (especificar)',
    showIf: pais('1', '2', '3', '4', '5', '6', '7', '8'),
  },
];

export const ESCALA_5: QuestionOption[] = [
  { value: '5', label: 'Excelente / Totalmente', labelPt: 'Excelente / Totalmente' },
  { value: '4', label: 'Bueno / Bastante', labelPt: 'Bom / Bastante' },
  { value: '3', label: 'Regular / Parcialmente', labelPt: 'Regular / Parcialmente' },
  { value: '2', label: 'Malo / Muy poco', labelPt: 'Mau / Muito pouco' },
  { value: '1', label: 'Muy malo / Nada', labelPt: 'Muito mau / Nada' },
];

export const ESCALA_SATISFACCION: QuestionOption[] = [
  { value: '5', label: 'Totalmente satisfecho', labelPt: 'Totalmente satisfeito' },
  { value: '4', label: 'Algo satisfecho', labelPt: 'Algo satisfeito' },
  { value: '3', label: 'Ni satisfecho ni insatisfecho', labelPt: 'Nem satisfeito nem insatisfeito' },
  { value: '2', label: 'Insatisfecho', labelPt: 'Insatisfeito' },
  { value: '1', label: 'Muy insatisfecho', labelPt: 'Muito insatisfeito' },
];

export const P7_OPCIONES: QuestionOption[] = [
  {
    value: '1',
    label: 'Da un precio cerrado inmediatamente',
    labelPt: 'Indica um preço fechado de imediato',
  },
  {
    value: '2',
    label: 'Da un rango de precio aproximado',
    labelPt: 'Indica uma faixa de preço aproximada',
  },
  {
    value: '3',
    label: 'Explica que depende de una visita presencial y del tipo de vivienda/negocio',
    labelPt: 'Explica que depende de uma visita presencial e do tipo de habitação/negócio',
  },
  {
    value: '4',
    label: 'Posterga la respuesta explicando que primero debe conocer las necesidades del cliente',
    labelPt: 'Adia a resposta explicando que primeiro tem de conhecer as necessidades do cliente',
  },
  {
    value: '5',
    label: 'Utiliza el precio como gancho obligatorio para forzar la visita presencial',
    labelPt: 'Utiliza o preço como gancho obrigatório para forçar a visita presencial',
  },
];

export const SI_P7_PRECIO: ConditionClause = { questionId: 'p7-precio-respuesta', values: ['1', '2'] };
export const NO_P7_PRECIO_CERRADO: ConditionClause = {
  questionId: 'p7-precio-respuesta',
  operator: 'notIn',
  values: ['1'],
};
export const SI_F4_HOGAR: ConditionClause = { questionId: 'f4-categoria', values: ['1'] };
export const SI_F4_NEGOCIO: ConditionClause = { questionId: 'f4-categoria', values: ['2'] };
export const SI_F5_PRESENCIAL: ConditionClause = { questionId: 'f5-canal', values: ['2'] };
export const SI_F3_PROSEGUR: ConditionClause = { questionId: 'f3-marca', values: ['11'] };
export const SI_F1_PORTUGAL: ConditionClause = { questionId: 'f1-pais', values: ['7'] };
export const SI_P31: ConditionClause = { questionId: 'p31-promociones', values: ['1'] };
export const SI_P32_ECONOMICA: ConditionClause = { questionId: 'p32-tipo-promo', values: ['1'] };
export const SI_P45: ConditionClause = { questionId: 'p45-proximo-contacto', values: ['1'] };
export const SI_P56: ConditionClause = { questionId: 'p56-recontacto', values: ['1'] };
export const SI_P59: ConditionClause = { questionId: 'p59-nueva-promo', values: ['1'] };
export const SI_P64: ConditionClause = { questionId: 'p64-segundo-recontacto', values: ['1'] };
export const SI_P67: ConditionClause = { questionId: 'p67-nueva-promo-2', values: ['1'] };
export const SI_P4_NO: ConditionClause = { questionId: 'p4-respeto', values: ['2'] };
export const SI_P16A: ConditionClause = { questionId: 'p16a-conversacion', values: ['1'] };
