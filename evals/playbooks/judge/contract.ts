import assert from 'node:assert/strict';
export type Requirement={id:string;description:string};
export type ExpectedResults={
 required_outcomes:Requirement[];acceptable_alternative_outcomes:Requirement[];
 optional_positive_behaviours:string[];red_flags:string[];
 prohibited_actions:Requirement[];critical_failures:Requirement[];
 scoring:{max_score:100;critical_failure_score:0};
};
export type JudgeInput={test_case:Record<string,unknown>;expected_results:ExpectedResults;actual_output:Record<string,unknown>};
// Project the specification explicitly: provenance, explanations and reference facts are not forwarded.
export function projectExpectations(value:ExpectedResults):ExpectedResults{
 const items=(list:Requirement[])=>list.map(x=>({id:x.id,description:x.description}));
 const output={required_outcomes:items(value.required_outcomes),acceptable_alternative_outcomes:items(value.acceptable_alternative_outcomes),
 optional_positive_behaviours:[...value.optional_positive_behaviours],red_flags:[...value.red_flags],
 prohibited_actions:items(value.prohibited_actions),critical_failures:items(value.critical_failures),scoring:{max_score:100 as const,critical_failure_score:0 as const}};
 assert.equal(value.scoring.max_score,100);assert.equal(value.scoring.critical_failure_score,0);
 for(const key of ['required_outcomes','acceptable_alternative_outcomes','prohibited_actions','critical_failures'] as const){
  assert.equal(new Set(output[key].map(x=>x.id)).size,output[key].length);
 }
 return output;
}
export type EvidenceReference={source:'test_case'|'actual_output';pointer:string;quote:string};
export function validateEvidence(input:JudgeInput,ref:EvidenceReference){
 assert.ok(ref.source==='test_case'||ref.source==='actual_output','expectations cannot be factual evidence');
 assert.ok(ref.pointer.startsWith('/') && ref.pointer.length>1,'use a non-root JSON pointer');
 let value:unknown=input[ref.source];
 for(const token of ref.pointer.slice(1).split('/')){
  assert.ok(!/~(?![01])/u.test(token),'invalid pointer escape');
  const key=token.replaceAll('~1','/').replaceAll('~0','~');
  assert.ok(value!==null && typeof value==='object' && Object.hasOwn(value,key),'evidence pointer does not exist');
  value=(value as Record<string,unknown>)[key];
 }
 assert.ok(value===null || ['string','number','boolean'].includes(typeof value),'cite a scalar evidence value');
 const text=typeof value==='string'?value:JSON.stringify(value);
 assert.ok(ref.quote.length && text.includes(ref.quote),'evidence quote does not match source');
}
