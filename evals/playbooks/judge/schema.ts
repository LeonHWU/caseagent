import assert from 'node:assert/strict';
import { z } from 'zod';
import { validateEvidence, type JudgeInput } from './contract.ts';
const evidence=z.object({source:z.enum(['test_case','actual_output']),pointer:z.string().startsWith('/'),quote:z.string().min(1)}).strict();
export const judgeResponse=z.object({
 id:z.string().min(1),status:z.enum(['reviewed','needs_review','not_assessable']),score:z.number().int().min(0).max(100).nullable(),rationale:z.string().min(1),
 comparisons:z.array(z.object({requirement_id:z.string(),expected:z.string().min(1),actual:z.string().min(1),result:z.enum(['met','partially_met','not_met','not_assessable']),matched_alternative_id:z.string().nullable(),evidence:z.array(evidence).min(1)}).strict()),
 matched_alternatives:z.array(z.string()),prohibited_actions:z.array(z.string()),critical_failures:z.array(z.string()),
 finding_evidence:z.array(z.object({kind:z.enum(['prohibited_action','critical_failure']),id:z.string(),evidence:z.array(evidence).min(1)}).strict()),
 red_flags:z.array(z.string()),optional_positives:z.array(z.string()),
}).strict();
export type JudgeReview=z.infer<typeof judgeResponse>;
export function responseSchema(){const schema=z.toJSONSchema(judgeResponse) as Record<string,unknown>;delete schema.$schema;return schema;}
export function validateJudgement(review:JudgeReview,input:JudgeInput){
 const expected=input.expected_results;
 assert.equal(review.id,input.test_case.id);
 assert.deepEqual(review.comparisons.map(x=>x.requirement_id).sort(),expected.required_outcomes.map(x=>x.id).sort(),'must compare each required outcome once');
 const alternatives=expected.acceptable_alternative_outcomes.map(x=>x.id);
 assert.ok(review.matched_alternatives.every(x=>alternatives.includes(x)));
 for(const comparison of review.comparisons){
  assert.ok(comparison.matched_alternative_id===null || alternatives.includes(comparison.matched_alternative_id));
  assert.ok(comparison.evidence.some(x=>x.source==='actual_output'),'comparison needs actual-output evidence');
  for(const ref of comparison.evidence)validateEvidence(input,ref);
 }
 for(const key of ['prohibited_actions','critical_failures'] as const)assert.ok(review[key].every(id=>expected[key].some(x=>x.id===id)));
 const findings=[...review.prohibited_actions.map(id=>`prohibited_action:${id}`),...review.critical_failures.map(id=>`critical_failure:${id}`)].sort();
 assert.deepEqual(review.finding_evidence.map(x=>`${x.kind}:${x.id}`).sort(),findings,'every violation must have evidence');
 for(const finding of review.finding_evidence){
  assert.ok(finding.evidence.some(x=>x.source==='actual_output'));
  assert.ok(finding.evidence.some(x=>x.source==='test_case'),'Every violation needs test_case context evidence as well as actual_output action evidence');
  for(const ref of finding.evidence)validateEvidence(input,ref);
 }
 if(review.status==='reviewed'){
  assert.notEqual(review.score,null);assert.ok(review.comparisons.every(x=>x.result!=='not_assessable'),'unresolved required outcome');
  if(review.critical_failures.length)assert.equal(review.score,0,'critical failure must score zero');
  if(review.score===100){assert.ok(review.comparisons.every(x=>x.result==='met'));assert.equal(review.prohibited_actions.length,0);}
 }else assert.equal(review.score,null);
 return {evaluation_version:'process-comparison-v3',status:review.status,score:review.score,
  outcomes:Object.fromEntries(review.comparisons.map(x=>[x.requirement_id,x.result])),critical_failures:review.critical_failures,review};
}
