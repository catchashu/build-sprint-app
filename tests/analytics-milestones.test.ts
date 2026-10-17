import test from 'node:test';
import assert from 'node:assert/strict';
import { createMilestones, WORKFLOW_EVENTS } from '../src/analyticsMilestones';
import { createConsentStore } from '../src/privacyConsent';
import { filterOutgoingEvent, workflowCollectionAllowed, createAnalytics } from '../src/analytics';

const first = 'tg_00000000-0000-4000-8000-000000000001';
const second = 'tg_00000000-0000-4000-8000-000000000002';
const anonymous = 'tg_00000000-0000-4000-8000-000000000003';
function fixture() {
  const saved = new Map<string,string>(), events: any[] = [];
  let consent = true;
  const storage = {getItem: (key:string) => saved.get(key) ?? null, setItem: (key:string,value:string) => {saved.set(key,value);}};
  const create = () => createMilestones(() => storage, () => consent, (event, properties) => {events.push({event, properties});}, () => anonymous);
  return {saved, events, create, withdraw: () => {consent=false;}};
}

test('milestones survive rerender, remount and refresh; separate journeys share anonymous identity', () => {
  const f=fixture();
  for (const event of WORKFLOW_EVENTS) { f.create().record(event, first, 'new'); f.create().record(event, first, 'reopened'); }
  assert.equal(f.events.length,4);
  f.create().record('onboarding_started',second,'new');
  assert.equal(f.events.length,5);
  assert.equal(f.events[0].properties.anonymous_id,f.events[4].properties.anonymous_id);
  assert.notEqual(f.events[0].properties.journey_id,f.events[4].properties.journey_id);
  assert.ok([...f.saved.keys()].every(key=>!key.includes('access')));
});

test('unseen restored results are explicitly reopened, and no milestones are backfilled', () => {
  const f=fixture();f.create().record('final_plan_viewed',first,'reopened');
  assert.deepEqual(f.events.map(e=>[e.event,e.properties.view_kind]),[['final_plan_viewed','reopened']]);
});

test('consent, invalid IDs, unavailable storage and sending failures cannot leak or throw', () => {
  const f=fixture();f.withdraw();
  assert.equal(f.create().journey(),undefined);
  f.create().record('onboarding_started',first,'new');
  assert.equal(f.saved.size,0);assert.equal(f.events.length,0);
  const broken=createMilestones(()=>{throw Error('blocked');},()=>true,()=>assert.fail('must not send'));
  assert.doesNotThrow(()=>broken.record('final_plan_viewed',first,'new'));
  const active=fixture();active.create().record('initial_results_viewed','research-access-token','new');assert.equal(active.events.length,0);
  const fail=createMilestones(()=>({getItem:()=>null,setItem(){}}),()=>true,()=>{throw Error('offline');},()=>anonymous);
  assert.doesNotThrow(()=>fail.record('onboarding_started',first,'new'));
});

test('workflow privacy boundary reconstructs only approved identifiers and enums', () => {
  const context={anonymous_id:anonymous,journey_id:first,view_kind:'new' as const};
  for(const event of WORKFLOW_EVENTS) {
    const raw={uuid:'00000000-0000-4000-8000-000000000004',event,properties:{$current_url:'private', $referrer:'private',distinct_id:'private',token:'private',research:'private',email:'private',invite_code:'private',backend:{private:true},$session_id:'private'},$set:{email:'private'}};
    assert.deepEqual(filterOutgoingEvent(raw,{analytics:true,recording:false},'phc_placeholder',context),{
      uuid:raw.uuid,event,properties:{token:'phc_placeholder',distinct_id:anonymous,journey_id:first,view_kind:'new',$process_person_profile:false,$geoip_disable:true},
    });
    assert.equal(filterOutgoingEvent(raw,{analytics:false,recording:true},'phc_placeholder',context),null);
    assert.equal(filterOutgoingEvent(raw,{analytics:true,recording:false},'phc_placeholder',{...context,journey_id:'research-token'}),null);
    assert.equal(filterOutgoingEvent(raw,{analytics:true,recording:false},'phc_placeholder'),null);
  }
});

test('production release lock blocks even enabled configuration and granted consent',async()=>{
  const env={PROD:true,MODE:'production',VITE_POSTHOG_ENABLED:'true',VITE_POSTHOG_HOST:'https://eu.i.posthog.com',VITE_POSTHOG_PROJECT_TOKEN:'phc_placeholder'};
  assert.equal(workflowCollectionAllowed(env),false);
  let loads=0;
  const consent=createConsentStore(()=>({getItem:()=>JSON.stringify({version:1,analytics:true,recording:false}),setItem(){},removeItem(){}}));
  const analytics=createAnalytics(async()=>{loads++;throw Error('must not load');},consent);
  await analytics.workflow('onboarding_started',{anonymous_id:anonymous,journey_id:first,view_kind:'new'},env);
  assert.equal(loads,0);
});
