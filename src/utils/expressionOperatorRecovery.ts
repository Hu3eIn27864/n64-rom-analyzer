import type { UnaryExpression,BinaryExpression } from './expressionOperators';
import type { ComparisonExpression } from './expressionComparisons';
import type { ConditionalExpression } from './conditionalExpression';
export interface ExpressionOperatorRecovery { readonly unary:readonly UnaryExpression[]; readonly binary:readonly BinaryExpression[]; readonly comparisons:readonly ComparisonExpression[]; readonly conditionals:readonly ConditionalExpression[]; readonly complete:boolean; }
export function recoverExpressionOperators(unary:readonly UnaryExpression[],binary:readonly BinaryExpression[],comparisons:readonly ComparisonExpression[],conditionals:readonly ConditionalExpression[]):ExpressionOperatorRecovery { return {unary:[...unary],binary:[...binary],comparisons:[...comparisons],conditionals:[...conditionals],complete:true}; }
