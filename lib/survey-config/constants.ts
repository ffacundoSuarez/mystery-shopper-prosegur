import { Condition, ConditionClause, QuestionOption } from '../types';

export const SI_NO: QuestionOption[] = [
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

export const SI_NO_COD: QuestionOption[] = [
  { value: '1', label: 'Sí' },
  { value: '2', label: 'No' },
];

export const PAISES: QuestionOption[] = [
  { value: '1', label: 'Argentina' },
  { value: '2', label: 'Colombia' },
  { value: '3', label: 'Perú' },
  { value: '4', label: 'Chile' },
  { value: '5', label: 'Paraguay' },
  { value: '6', label: 'Uruguay' },
  { value: '7', label: 'Portugal' },
  { value: '8', label: 'Alemania' },
];

/** Condición: país = código(s) */
export function pais(...codes: string[]): ConditionClause {
  return { questionId: 'f1-pais', values: codes };
}

function regionOptions(cityLabel: string, extra: QuestionOption[] = []): QuestionOption[] {
  return [{ value: 'principal', label: cityLabel }, { value: 'otro', label: 'Otro' }, ...extra];
}

export const REGION_ARG = regionOptions('AMBA (Gran Buenos Aires & CABA)');
export const REGION_COL = regionOptions('Bogotá');
export const REGION_PER = regionOptions('Lima');
export const REGION_CHI = regionOptions('Santiago');
export const REGION_PRY = regionOptions('Asunción');
export const REGION_URY = regionOptions('Montevideo');
export const REGION_POR = regionOptions('Lisboa');
export const REGION_DEU: QuestionOption[] = [
  { value: 'essen', label: 'Essen' },
  { value: 'dortmund', label: 'Dortmund' },
  { value: 'dusseldorf', label: 'Düsseldorf' },
  { value: 'colonia', label: 'Colonia' },
  { value: 'berlin', label: 'Berlin' },
  { value: 'munich', label: 'Munich' },
  { value: 'otro', label: 'Otro' },
];

/** Marcas F3 filtradas por país (rotate en la pregunta) */
export const MARCAS: QuestionOption[] = [
  { value: '1', label: 'ADT', showIf: pais('1', '2', '3') },
  { value: '2', label: 'Verisure', showIf: pais('1', '2', '3', '4') },
  { value: '3', label: 'Telesentinel', showIf: pais('1') },
  { value: '4', label: 'Alarmar', showIf: pais('1') },
  { value: '5', label: 'Atlas', showIf: pais('1') },
  { value: '6', label: 'Securitas', showIf: pais('1') },
  { value: '7', label: 'Protek', showIf: pais('1') },
  { value: '8', label: 'Nos Securitas', showIf: pais('1') },
  { value: '9', label: 'Securitas Direct – Verisure', showIf: pais('1') },
  { value: '10', label: 'Maxima', showIf: pais('1') },
  { value: '11', label: 'Prosegur', showIf: pais('1', '2', '3', '4', '5', '6', '7', '8') },
  { value: '12', label: 'Secu24', showIf: pais('1') },
  { value: '13', label: 'Otra (especificar)', showIf: pais('1', '2', '3', '4', '5', '6', '7', '8') },
];

export const ESCALA_5: QuestionOption[] = [
  { value: '5', label: 'Excelente / Totalmente' },
  { value: '4', label: 'Bueno / Bastante' },
  { value: '3', label: 'Regular / Parcialmente' },
  { value: '2', label: 'Malo / Muy poco' },
  { value: '1', label: 'Muy malo / Nada' },
];

export const ESCALA_SATISFACCION: QuestionOption[] = [
  { value: '5', label: 'Totalmente satisfecho' },
  { value: '4', label: 'Algo satisfecho' },
  { value: '3', label: 'Ni satisfecho ni insatisfecho' },
  { value: '2', label: 'Insatisfecho' },
  { value: '1', label: 'Muy insatisfecho' },
];

export const P7_OPCIONES: QuestionOption[] = [
  { value: '1', label: 'Da un precio cerrado inmediatamente' },
  { value: '2', label: 'Da un rango de precio aproximado' },
  { value: '3', label: 'Explica que depende de una visita presencial y del tipo de vivienda/negocio' },
  { value: '4', label: 'Posterga la respuesta explicando que primero debe conocer las necesidades del cliente' },
  { value: '5', label: 'Utiliza el precio como gancho obligatorio para forzar la visita presencial' },
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
