// Demo state — the same technique as the Play Store screenshot rig: a neutral
// profile with realistic progress so the screens are populated rather than empty.
// Nothing here is presented as a real user's data.
const NOW = Date.now();
const D = n => new Date(NOW - n*864e5).toISOString().slice(0,10);
const ans = (q,cov,said,model) => ({
  q, ask:q, answered:true, said, coverage:cov,
  covered:[{label:"Said who you are"},{label:"Named your experience"}],
  missed:[{label:"Name the processes you run"}],
  model, vocabUsed:["procedure"], vocabMissed:["porosity","undercut"],
  characterId:"hr", why:"Employers listen for the processes you actually run."
});
export const seed = (area="welding") => ({
  days:{ w1Mon:true,w1Tue:true,w1Wed:true,"welding:w1Mon":true,"welding:w1Tue":true },
  steps:{}, notes:{}, scores:{}, phMaster:{}, phExample:{}, weekly:{}, monthly:{},
  tutor:{}, clips:[], trouble:{}, fbV:{}, startDate:D(16),
  profile:{ name:"Alex", role:"Engineering / Data", goal:"meetings", slot:"07:00", ts:NOW },
  professionalTracks:{ activeId:area },
  competency:{logs:[],achievements:{}}, coach:{summaries:[],memory:{}},
  careerCenter:{destination:"international-contractor",resume:""},
  areaSplit:1,
  fbHist:[
    {ts:NOW-9*864e5,score:41,wpm:88,words:96,tk:area},
    {ts:NOW-6*864e5,score:57,wpm:97,words:120,tk:area},
    {ts:NOW-3*864e5,score:68,wpm:104,words:141,tk:area},
    {ts:NOW-1*864e5,score:79,wpm:109,words:158,tk:area},
  ],
  convos:[{ts:NOW-2*864e5,id:"c1",title:"Toolbox talk",covered:3,total:3,overall:82,tk:area}],
  vocab:{ procedure:{l:"B2",ts:NOW-5*864e5,tk:[area]}, porosity:{l:"B2",ts:NOW-3*864e5,tk:[area]},
          undercut:{l:"B2",ts:NOW-3*864e5,tk:[area]}, handover:{l:"B1",ts:NOW-2*864e5,tk:[area]},
          isolation:{l:"C1",ts:NOW-864e5,tk:[area]} },
  troubleA:{ [area]:{ porosity:3, undercut:2, penetration:1 } },
  dayLogA:{ [area]:{ [D(9)]:1,[D(6)]:2,[D(5)]:1,[D(3)]:2,[D(2)]:1,[D(1)]:3,[D(0)]:1 } },
  weeklyA:{}, monthlyA:{}, phMasterA:{[area]:{p0:true,p1:true,p2:true}},
  phExampleA:{[area]:{p0:"I run MIG and TIG on structural steel."}},
  gramA:{[area]:{tenses:{best:80,runs:4,hist:[{p:55,t:NOW-4*864e5},{p:80,t:NOW-864e5}]}}},
  clipsA:{}, quizHistA:{[area]:[{t:NOW-3*864e5,p:60},{t:NOW-864e5,p:90}]},
  dates:[D(9),D(6),D(5),D(3),D(2),D(1),D(0)],
  dayLog:{ [D(9)]:1,[D(6)]:2,[D(5)]:1,[D(3)]:2,[D(2)]:1,[D(1)]:3,[D(0)]:1 },
  simulations:{ history:[], attempts:{ "welding-sim-1":[{
    startedAt:NOW-2*864e5, at:NOW-2*864e5, coverage:0.62, answered:4, asked:4, tk:area,
    answers:[
      ans("Tell me about yourself and the work you've done.",0.4,
          "I'm the new welder and I've been working for three years.",
          "I'm a certified welder with three years on structural steel, mainly MIG and TIG."),
      ans("What processes do you run?",0.85,
          "I run MIG and TIG on structural steel every day.",
          "I run MIG and TIG daily on structural steel, to AWS D1.1."),
      ans("Walk me through a weld you are proud of.",0.6,
          "I welded a pressure vessel seam last year.",
          "Last year I welded a pressure vessel seam, full penetration, passed RT first time."),
      ans("How do you handle a safety concern?",0.55,
          "I stop and tell the supervisor.",
          "I stop the job, isolate it, and raise it with the supervisor before we continue."),
    ]}]}}
});
