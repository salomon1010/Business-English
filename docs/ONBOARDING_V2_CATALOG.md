# BE Mastery — Onboarding V2 catalogs (as implemented)

Status: **implemented, behind the flag `onboarding_v2_enabled` (OFF in production). General English only.**
Generated from the single source `scripts/onboarding/build-catalog.py` → `onboarding-catalog.js`; every count below is computed from the shipped data, not written by hand. Regenerate with `python3 scripts/onboarding/build-catalog.py`.
IDs are stable and never shown to a learner. Labels are the English source text, displayed through `t("<prefix>.<id>")` with this text as the fallback. **A released id is never renamed or removed**; `tests/fixtures/legacy-profession-ids.json` freezes the original 181 and `tests/onboarding-catalog.test.mjs` fails if any disappears.

## 1. Counts and selection rules
| Catalog | Entries | Select | Limit | i18n prefix |
|---|---|---|---|---|
| Profession | 284 in 17 groups (2 legacy-mapping rows hidden → 282 selectable) | single | 1, Other text ≤60 chars | `prof.` / `pg.` |
| Main goal | 14 | single | 1 | `goal.` |
| Daily situations | 16 in 4 groups | multi, ordered | 4; the first becomes the **main focus**, changeable | `sit.` / `sitg.` |
| Speaking confidence | 5 | single | 1 | `conf.` |
| Improvement priorities | 14 in 3 groups | multi, ranked | 3 | `prio.` / `prg.` |
| Vocabulary goals | 14 | multi | 3 | `vocab.` |
| Practice methods | 10 | multi | 3 | `meth.` |
| Minutes a day / days a week / time of day | 9 / 5 / 5 | single each | 1 each | `min.` / `day.` / `tod.` |
| Native language | the app's own 105-language table (`LANGS`), reused — not a second list | single | 1 | — |

Search covers the localised label, the English label, the aliases and the group name; it ignores case and accents, and every typed word must match.

## 2. Professions (284)
`+` marks the 103 added on 7 Nov 2026; the rest are the original ids, unchanged. `(hidden)` = kept only so an old stored answer maps, never offered.

### Technology, software, data & AI (`tech`) — 25
| Id | Label | Search aliases |
|---|---|---|
| `tech.software_engineer` | Software engineer | developer programmer coder swe |
| `tech.frontend_dev` | Front-end developer | front end frontend web developer ui |
| `tech.backend_dev` | Back-end developer | back end backend server api |
| `tech.fullstack_dev` | Full-stack developer | full stack fullstack |
| `tech.mobile_dev` | Mobile app developer | ios android app developer |
| `tech.devops_sre` | DevOps / site reliability engineer | devops sre platform infrastructure |
| `tech.cloud_engineer` | Cloud engineer | aws azure gcp cloud |
| `tech.data_analyst` | Data analyst | analytics bi reporting sql |
| `tech.data_engineer` | Data engineer | pipelines etl warehouse |
| `tech.data_scientist` | Data scientist | statistics modelling analytics |
| `tech.ml_engineer` | Machine learning engineer | ml ai deep learning |
| `tech.qa_tester` | QA / software tester | quality assurance testing test engineer |
| `tech.it_support` | IT support specialist | help desk helpdesk service desk technician |
| `tech.sysadmin` | Systems administrator | sysadmin system admin it admin |
| `tech.network_engineer` | Network engineer | networking cisco |
| `tech.cybersecurity` | Cybersecurity specialist | security infosec soc |
| `tech.ux_designer` | UX / UI designer | ux ui user experience product designer |
| `tech.tech_lead` | Technical lead | tech lead engineering lead team lead |
| `tech.solutions_architect` | Solutions architect | architect pre-sales engineer |
| `tech.ai_engineer` | + AI engineer | artificial intelligence llm |
| `tech.database_admin` | + Database administrator | dba sql |
| `tech.game_developer` | + Game developer | unity unreal |
| `tech.embedded_engineer` | + Embedded systems engineer | firmware iot |
| `tech.technical_writer` | + Technical writer | documentation |
| `tech.product_analyst` | + Product analyst | — |

### Product, project & management (`mgmt`) — 13
| Id | Label | Search aliases |
|---|---|---|
| `tech.product_manager` | Product manager | pm product owner |
| `tech.scrum_master` | Scrum master / agile coach | agile scrum coach |
| `biz.manager` | Manager / team leader | supervisor line manager |
| `biz.executive` | Executive / director | ceo cfo cto vp |
| `biz.entrepreneur` | Entrepreneur / business owner | founder startup self employed |
| `biz.consultant` | Consultant | advisor |
| `biz.project_manager` | Project manager | pm programme manager delivery |
| `biz.operations_manager` | Operations manager | — |
| `biz.strategy` | Strategy / planning | — |
| `mgmt.program_manager` | + Programme manager | — |
| `mgmt.operations_analyst` | + Operations analyst | — |
| `mgmt.product_owner` | + Product owner | — |
| `mgmt.team_coordinator` | + Team coordinator | — |

### Business, finance & accounting (`bizfin`) — 21
| Id | Label | Search aliases |
|---|---|---|
| `biz.hr_professional` | HR professional | human resources people ops |
| `biz.recruiter` | Recruiter | talent acquisition |
| `biz.office_admin` | Office administrator | admin receptionist |
| `biz.executive_assistant` | Executive assistant | ea pa personal assistant |
| `biz.business_analyst` | Business analyst | ba requirements |
| `biz.procurement` | Procurement / purchasing | buyer sourcing |
| `fin.accountant` | Accountant | accounting bookkeeping |
| `fin.financial_analyst` | Financial analyst | fp&a |
| `fin.banker` | Banker / bank officer | bank teller |
| `fin.auditor` | Auditor | — |
| `fin.insurance` | Insurance professional | underwriter claims broker |
| `fin.investment` | Investment / wealth professional | wealth manager trader |
| `fin.tax_advisor` | Tax adviser | — |
| `fin.finance_generic` | Finance / Business (old answer) *(hidden)* | — |
| `bizfin.bookkeeper` | + Bookkeeper | — |
| `bizfin.payroll_specialist` | + Payroll specialist | — |
| `bizfin.financial_planner` | + Financial planner | financial adviser |
| `bizfin.actuary` | + Actuary | — |
| `bizfin.loan_officer` | + Loan officer | mortgage lending |
| `bizfin.credit_analyst` | + Credit analyst | — |
| `bizfin.controller` | + Financial controller | — |

### Sales, marketing & customer service (`sales`) — 13
| Id | Label | Search aliases |
|---|---|---|
| `sales.sales_rep` | Sales representative | salesperson |
| `sales.account_manager` | Account manager | — |
| `sales.marketer` | Marketing specialist | marketing |
| `sales.digital_marketer` | Digital marketer | seo ppc social media |
| `sales.customer_support` | Customer service representative | csr customer care |
| `sales.call_centre` | Call centre agent | call center contact centre |
| `sales.customer_success` | Customer success manager | — |
| `sales.business_development` | Business development | bd |
| `sales.sales_marketing_generic` | Sales / Marketing (old answer) *(hidden)* | — |
| `sales.retail_sales_rep` | + Retail sales representative | — |
| `sales.inside_sales` | + Inside sales / telesales | sdr bdr |
| `sales.customer_service_manager` | + Customer service manager | — |
| `sales.social_media_manager` | + Social media manager | — |

### Engineering, manufacturing & quality (`eng`) — 21
| Id | Label | Search aliases |
|---|---|---|
| `eng.mechanical_eng` | Mechanical engineer | — |
| `eng.electrical_eng` | Electrical engineer | — |
| `eng.chemical_eng` | Chemical engineer | — |
| `eng.industrial_eng` | Industrial engineer | process improvement lean |
| `eng.project_engineer` | Project engineer | — |
| `eng.hse_officer` | Health, safety & environment (HSE) officer | hse ehs safety officer |
| `eng.engineering_technician` | Engineering technician | technician |
| `energy.instrumentation_tech` | Instrumentation technician | instrument i&c |
| `energy.plant_engineer` | Plant engineer | — |
| `energy.inspector_ndt` | Inspector / NDT technician | ndt inspection non destructive |
| `ops.factory_operator` | Factory / production operator | assembly line machine operator |
| `ops.quality_inspector` | Quality control inspector | qc quality |
| `ops.production_supervisor` | Production supervisor | — |
| `eng.quality_engineer` | + Quality engineer | — |
| `eng.manufacturing_engineer` | + Manufacturing engineer | — |
| `eng.automation_engineer` | + Automation engineer | plc robotics |
| `eng.aerospace_engineer` | + Aerospace engineer | — |
| `eng.automotive_engineer` | + Automotive engineer | — |
| `eng.biomedical_engineer` | + Biomedical engineer | — |
| `eng.process_engineer` | + Process engineer | — |
| `eng.safety_engineer` | + Safety engineer | — |

### Skilled trades & construction (`trades`) — 29
| Id | Label | Search aliases |
|---|---|---|
| `eng.civil_eng` | Civil engineer | construction engineer |
| `eng.structural_eng` | Structural engineer | — |
| `eng.site_manager` | Construction site manager | site supervisor foreman |
| `eng.architect` | Architect | — |
| `eng.surveyor` | Land surveyor | — |
| `eng.quantity_surveyor` | Quantity surveyor | qs cost estimator |
| `trades.welder` | Welder | welding fabricator |
| `trades.pipefitter` | Pipefitter | pipe fitter |
| `trades.boilermaker` | Boilermaker | — |
| `trades.millwright` | Millwright | — |
| `trades.electrician` | Electrician | — |
| `trades.plumber` | Plumber | — |
| `trades.mechanic` | Mechanic (vehicle / equipment) | auto mechanic technician |
| `trades.carpenter` | Carpenter | joiner |
| `trades.machinist` | Machinist | cnc |
| `trades.maintenance_tech` | Maintenance technician | maintenance |
| `trades.hvac_tech` | HVAC technician | air conditioning heating |
| `trades.mason` | Mason / bricklayer | — |
| `trades.painter_decorator` | Painter / decorator | — |
| `trades.heavy_equipment_operator` | Heavy equipment operator | excavator crane |
| `trades.roofer` | + Roofer | — |
| `trades.tiler` | + Tiler | — |
| `trades.plasterer` | + Plasterer | — |
| `trades.scaffolder` | + Scaffolder | — |
| `trades.glazier` | + Glazier | — |
| `trades.crane_operator` | + Crane operator | — |
| `trades.sheet_metal_worker` | + Sheet metal worker | — |
| `trades.fitter` | + Fitter / fabricator | — |
| `trades.construction_worker` | + Construction worker | labourer builder |

### Healthcare & pharmaceuticals (`health`) — 22
| Id | Label | Search aliases |
|---|---|---|
| `health.doctor` | Doctor / physician | gp md medical doctor |
| `health.nurse` | Nurse | rn registered nurse |
| `health.pharmacist` | Pharmacist | pharmacy |
| `health.dentist` | Dentist | — |
| `health.physiotherapist` | Physiotherapist | physical therapist physio |
| `health.lab_technician` | Medical laboratory technician | lab tech |
| `health.radiographer` | Radiographer | x-ray imaging |
| `health.midwife` | Midwife | — |
| `health.caregiver` | Care worker / carer | carer care assistant nursing home |
| `health.mental_health` | Counsellor / mental health professional | therapist psychologist counselor |
| `health.health_admin` | Healthcare administrator | hospital admin |
| `health.paramedic` | Paramedic | ambulance emt |
| `health.vet` | Veterinarian | vet animal doctor |
| `health.pharma_biotech` | Pharma / biotech professional | pharmaceutical biotechnology clinical research |
| `health.surgeon` | + Surgeon | — |
| `health.optometrist` | + Optometrist | optician |
| `health.speech_therapist` | + Speech and language therapist | — |
| `health.occupational_therapist` | + Occupational therapist | — |
| `health.dental_hygienist` | + Dental hygienist | — |
| `health.pharmacy_technician` | + Pharmacy technician | — |
| `health.healthcare_assistant` | + Healthcare assistant | hca nursing assistant |
| `health.medical_receptionist` | + Medical receptionist | — |

### Education & research (`edu`) — 13
| Id | Label | Search aliases |
|---|---|---|
| `edu.teacher` | School teacher | — |
| `edu.university_lecturer` | University lecturer | professor |
| `edu.researcher` | Researcher / academic | scientist research |
| `edu.tutor` | Tutor | — |
| `edu.school_admin` | School administrator | — |
| `edu.trainer` | Corporate trainer | learning and development l&d |
| `edu.librarian` | Librarian | — |
| `edu.teaching_assistant` | Teaching assistant | — |
| `edu.scientist` | Scientist | lab research |
| `edu.early_years_teacher` | + Early years teacher | nursery kindergarten |
| `edu.language_teacher` | + Language teacher | english teacher tefl esl |
| `edu.school_counsellor` | + School counsellor | — |
| `edu.education_consultant` | + Education consultant | — |

### Logistics, transport & supply chain (`logistics`) — 18
| Id | Label | Search aliases |
|---|---|---|
| `ops.supply_chain` | Supply chain / planning | — |
| `ops.warehouse` | Warehouse worker | forklift picker packer |
| `ops.driver_courier` | Delivery driver / courier | delivery |
| `ops.logistics_coordinator` | Logistics coordinator | — |
| `ops.shipping_port` | Shipping / port worker | docker stevedore |
| `transport.pilot` | Pilot | — |
| `transport.cabin_crew` | Cabin crew | flight attendant |
| `transport.air_traffic` | Air traffic controller | — |
| `transport.ship_officer` | Ship officer / mariner | seaman captain |
| `transport.seafarer` | Seafarer / deck crew | sailor |
| `transport.rail_staff` | Rail staff | train |
| `transport.bus_taxi_driver` | Bus / taxi / rideshare driver | uber driver |
| `logistics.freight_forwarder` | + Freight forwarder | — |
| `logistics.customs_broker` | + Customs broker | — |
| `logistics.dispatcher` | + Dispatcher | — |
| `logistics.truck_driver` | + Truck driver | lorry hgv |
| `logistics.fleet_manager` | + Fleet manager | — |
| `logistics.delivery_rider` | + Delivery rider | bike courier food delivery |

### Hospitality, food & tourism (`hosp`) — 14
| Id | Label | Search aliases |
|---|---|---|
| `host.hotel_staff` | Hotel staff | — |
| `host.receptionist` | Receptionist | front desk |
| `host.chef_cook` | Chef / cook | kitchen |
| `host.waiter_barista` | Waiter / waitress / barista | server cafe |
| `host.travel_agent` | Travel agent | — |
| `host.tour_guide` | Tour guide | — |
| `host.event_planner` | Event planner | — |
| `host.restaurant_manager` | Restaurant manager | — |
| `hosp.bartender` | + Bartender | — |
| `hosp.housekeeper` | + Hotel housekeeper | — |
| `hosp.concierge` | + Concierge | — |
| `hosp.hotel_manager` | + Hotel manager | — |
| `hosp.sous_chef` | + Sous chef / line cook | — |
| `hosp.baker` | + Baker / pastry chef | — |

### Beauty, wellness & personal services (`beauty`) — 9
| Id | Label | Search aliases |
|---|---|---|
| `retail.beauty_wellness` | Beauty / wellness professional | beautician |
| `retail.fitness_coach` | Fitness coach | personal trainer gym |
| `beauty.hairdresser` | + Hairdresser / hair stylist | hairstylist |
| `beauty.barber` | + Barber | — |
| `beauty.makeup_artist` | + Make-up artist | — |
| `beauty.nail_technician` | + Nail technician | manicurist |
| `beauty.massage_therapist` | + Massage therapist | — |
| `beauty.spa_therapist` | + Spa therapist | esthetician beauty therapist |
| `beauty.yoga_instructor` | + Yoga / pilates instructor | — |

### Retail, real estate & property (`retail`) — 10
| Id | Label | Search aliases |
|---|---|---|
| `retail.shop_assistant` | Shop assistant | sales associate retail assistant |
| `retail.store_manager` | Store manager | — |
| `retail.cashier` | Cashier | — |
| `retail.real_estate` | Real estate agent | realtor estate agent property |
| `retail.property_manager` | + Property manager | landlord letting |
| `retail.leasing_agent` | + Leasing agent | lettings |
| `retail.mortgage_broker` | + Mortgage broker | — |
| `retail.home_inspector` | + Home inspector | — |
| `retail.estate_valuer` | + Property valuer | appraiser |
| `retail.merchandiser` | + Visual merchandiser | — |

### Legal, government & public service (`legalgov`) — 18
| Id | Label | Search aliases |
|---|---|---|
| `fin.lawyer` | Lawyer | solicitor attorney barrister |
| `fin.paralegal` | Paralegal | legal assistant |
| `fin.compliance` | Compliance / risk officer | aml risk |
| `public.civil_servant` | Civil servant | public sector |
| `public.police_security` | Police / security officer | — |
| `public.military` | Military / armed forces | army navy air force |
| `public.firefighter` | Firefighter | — |
| `public.social_worker` | Social worker | — |
| `public.ngo_worker` | NGO / non-profit worker | charity |
| `public.diplomat` | Diplomat | — |
| `public.government_officer` | Government officer | — |
| `retail.security_guard` | Security guard | — |
| `legalgov.court_clerk` | + Court clerk | — |
| `legalgov.immigration_officer` | + Immigration officer | — |
| `legalgov.customs_officer` | + Customs officer | — |
| `legalgov.urban_planner` | + Urban planner | town planner |
| `legalgov.policy_analyst` | + Policy analyst | — |
| `legalgov.legal_secretary` | + Legal secretary | — |

### Telecom, media & creative (`media`) — 18
| Id | Label | Search aliases |
|---|---|---|
| `tech.telecom_engineer` | Telecom engineer | telecommunications network radio 5g |
| `sales.pr_comms` | PR / communications | public relations comms |
| `creative.designer` | Graphic / visual designer | graphic design |
| `creative.writer_editor` | Writer / editor | copywriter author |
| `creative.journalist` | Journalist | reporter |
| `creative.translator` | Translator / interpreter | — |
| `creative.video_producer` | Video producer | filmmaker editor |
| `creative.photographer` | Photographer | — |
| `creative.musician_artist` | Musician / artist | — |
| `creative.content_creator` | Content creator | youtuber influencer |
| `media.radio_presenter` | + Radio / TV presenter | — |
| `media.tv_producer` | + TV / film producer | — |
| `media.sound_engineer` | + Sound engineer | audio |
| `media.animator` | + Animator | motion graphics |
| `media.illustrator` | + Illustrator | — |
| `media.fashion_designer` | + Fashion designer | — |
| `media.interior_designer` | + Interior designer | — |
| `media.podcaster` | + Podcaster | — |

### Agriculture, environment & energy (`agri`) — 18
| Id | Label | Search aliases |
|---|---|---|
| `eng.petroleum_eng` | Petroleum engineer | oil gas reservoir drilling engineer |
| `eng.environmental_eng` | Environmental engineer | — |
| `energy.process_operator` | Process / plant operator | refinery operator control room |
| `energy.drilling_crew` | Drilling / rig crew | roughneck offshore rig |
| `energy.geologist` | Geologist | — |
| `energy.mining_worker` | Mining worker | miner |
| `energy.power_plant_operator` | Power plant operator | — |
| `energy.renewable_tech` | Renewable energy technician | solar wind |
| `retail.farmer_agri` | Farmer / agricultural worker | farm agriculture |
| `agri.agronomist` | + Agronomist | — |
| `agri.forestry_worker` | + Forestry worker | — |
| `agri.fisheries_worker` | + Fisheries / aquaculture worker | fisherman |
| `agri.environmental_scientist` | + Environmental scientist | — |
| `agri.conservation_worker` | + Conservation / wildlife worker | ranger |
| `agri.solar_installer` | + Solar installer | — |
| `agri.wind_technician` | + Wind turbine technician | — |
| `agri.water_treatment_operator` | + Water treatment operator | — |
| `agri.waste_management_worker` | + Waste management worker | recycling |

### Home, community & volunteering (`home`) — 9
| Id | Label | Search aliases |
|---|---|---|
| `retail.cleaner_facilities` | Cleaner / facilities staff | janitor cleaning |
| `retail.domestic_worker` | Domestic worker / nanny | housekeeper maid nanny |
| `seek.homemaker` | Homemaker | stay at home parent housewife |
| `seek.volunteer` | Volunteer | — |
| `home.childcare_worker` | + Childcare worker | nursery nurse childminder |
| `home.community_organizer` | + Community organiser | — |
| `home.faith_leader` | + Faith / religious worker | pastor imam priest |
| `home.youth_worker` | + Youth worker | — |
| `home.stay_at_home_parent` | + Stay-at-home parent | — |

### Students, career transitions, retirement & Other (`career`) — 13
| Id | Label | Search aliases |
|---|---|---|
| `early.school_student` | School student | — |
| `early.university_student` | University student | college student undergraduate |
| `early.graduate` | Recent graduate | new grad |
| `early.intern` | Intern | internship trainee |
| `early.apprentice` | Apprentice | — |
| `early.phd_student` | PhD / graduate researcher | doctoral masters student |
| `seek.job_seeker` | Looking for a job | unemployed job hunting |
| `seek.career_changer` | Changing careers | career change switch |
| `seek.returning_to_work` | Returning to work after a break | — |
| `seek.freelancer` | Freelancer | contractor self employed |
| `seek.between_roles` | Between jobs | — |
| `seek.retired` | Retired | retirement pensioner |
| `other.other` | Other (not listed) | — |

## 3. Main goal (single)
`legacy` = the exact string already stored on existing learners; it is still written for those four.
| Id | Label | Legacy value |
|---|---|---|
| `speak_meetings` | Speak confidently in meetings | `🎤 Speak confidently in meetings` |
| `sound_executive` | Sound more executive | `💼 Sound more executive` |
| `ace_interviews` | Ace interviews in English | `🏆 Ace interviews in English` |
| `improve_accent` | Improve my accent & clarity | `🗣️ Improve my accent & clarity` |
| `customer_clients` | Handle clients and customers | — |
| `career_growth` | Grow in my career | — |
| `get_promoted` | Get promoted | — |
| `lead_teams` | Lead and motivate a team | — |
| `present_confidently` | Present with confidence | — |
| `phone_video_calls` | Speak confidently on phone and video calls | — |
| `academic_settings` | Communicate confidently in academic settings | — |
| `relocate_abroad` | Work or live abroad | — |
| `everyday_confidence` | Feel confident every day | — |
| `travel_socialise` | Travel and socialise | — |

## 4. Daily situations (multi, ordered, max 4)
The first chosen is the initial **main focus**, and an explicit control changes it. The main focus is what DailyLearningPlan builds the lesson scenario from.
| Id | Label | Group | Lesson scenario today |
|---|---|---|---|
| `meetings` | Meetings | At work | yes |
| `presentations` | Presentations | At work | yes |
| `interviews` | Job interviews | At work | yes |
| `standups` | Team updates and stand-ups | At work | yes |
| `calls` | Phone and video calls | At work | yes |
| `clients` | Clients and customers | At work | yes |
| `customer_service` | Helping customers | At work | yes |
| `negotiation` | Negotiating | At work | yes |
| `workplace_safety` | Safety and instructions at work | At work | yes |
| `networking` | Networking events | Meeting people | yes |
| `small_talk` | Small talk with colleagues | Meeting people | yes |
| `socialising` | Social situations and friends | Meeting people | yes |
| `everyday` | Everyday conversations | Daily life | yes |
| `travel` | Travelling | Daily life | yes |
| `healthcare_visits` | Doctors and public services | Daily life | yes |
| `skills` | Learning and studying | Study | yes |

## 5. Speaking confidence (single, self-reported)
The STORED value is the English label itself (what DailyLearningPlan keys on), so nothing already saved changes. Never converted into a CEFR level.
| Id | Stored value / label |
|---|---|
| `new` | New to speaking English |
| `get_by` | Can get by |
| `comfortable` | Comfortable but not confident |
| `fluent` | Fluent, want to sound sharper |
| `unsure` | Not sure |

## 6. Improvement priorities (multi, ranked, max 3)
Declared preferences. The four pronunciation ones reach the lesson as `pronunciationFocus.declared`; corrections still come only from the learner's own recording.
| Id | Label | Group | Pronunciation |
|---|---|---|---|
| `pronunciation` | Pronunciation | Pronunciation | yes |
| `word_stress_rhythm` | Word stress and rhythm | Pronunciation | yes |
| `intonation` | Intonation | Pronunciation | yes |
| `accent` | Accent | Pronunciation | yes |
| `fluency` | Fluency | Fluency and confidence | — |
| `reduce_hesitation` | Fewer pauses and fillers | Fluency and confidence | — |
| `confidence` | Speaking up with confidence | Fluency and confidence | — |
| `clarity_structure` | Clear, structured answers | Fluency and confidence | — |
| `vocabulary` | Vocabulary | Language and tone | — |
| `idioms_phrases` | Idioms and set phrases | Language and tone | — |
| `grammar` | Grammar | Language and tone | — |
| `professional_tone` | Professional tone | Language and tone | — |
| `listening` | Listening | Language and tone | — |
| `writing_to_speech` | Say what I write | Language and tone | — |

## 7. Vocabulary goals (multi, max 3)
| Id | Label |
|---|---|
| `work_vocab` | Everyday workplace vocabulary |
| `industry_terms` | Terms for my field |
| `meeting_phrases` | Meeting phrases |
| `phone_phrases` | Phone and video call phrases |
| `formal_phrases` | Formal and polite phrases |
| `softening_language` | Diplomatic, softening language |
| `phrasal_verbs` | Phrasal verbs |
| `idioms` | Idioms |
| `collocations` | Natural word pairs |
| `connectors` | Linking words |
| `numbers_data` | Numbers, data and dates |
| `small_talk_phrases` | Small-talk phrases |
| `academic_words` | Academic vocabulary |
| `travel_words` | Travel and daily-life words |

## 8. Practice methods (multi, max 3)
Every option points at a feature that exists today; choosing one expresses interest and unlocks nothing.
| Id | Label | Feature |
|---|---|---|
| `shadowing` | Shadowing videos | Shadow Studio |
| `record_report` | Record myself and get a report | Speaking report |
| `ai_coach` | Chat with the AI coach | AI coach |
| `role_play` | Role-play conversations | Life Simulations |
| `partner` | Practise with a partner | Practice Partner |
| `phrase_drills` | Phrase and vocabulary drills | Phrase bank |
| `watch_listen` | Watch and listen | Shadow Studio Watch |
| `vocab_games` | Word games | English Mastery |
| `mission_tasks` | Real-life missions | Missions |
| `review_trouble_words` | Review my trouble words | Trouble words |

## 9. Scheduling
**Minutes a day** — also sizes the number of expressions per lesson (3 for 5-10 min, 4 for 15-20, 5 otherwise).
| Id | Label |
|---|---|
| `m5` | 5 minutes |
| `m10` | 10 minutes |
| `m15` | 15 minutes |
| `m20` | 20 minutes |
| `m25` | 25 minutes |
| `m30` | 30 minutes |
| `m45` | 45 minutes |
| `m60` | 60 minutes |
| `flexible` | It varies |

**Days a week**
| Id | Label |
|---|---|
| `d3` | 3 days a week |
| `d4` | 4 days a week |
| `d5` | 5 days a week |
| `d6` | 6 days a week |
| `d7` | Every day |

**Time of day** — sets the DEFAULT reminder time when the learner switches the reminder on. It never changes lesson content, order, objectives or completion criteria.
| Id | Label | Default reminder |
|---|---|---|
| `morning` | Morning | 08:00 |
| `lunch` | Lunch break | 12:30 |
| `commute` | Commute | 17:30 |
| `evening` | Evening | 20:00 |
| `anytime` | No set time | — |

## 10. Legacy mapping (existing learners)
| Old stored value | Maps to | Note |
|---|---|---|
| `Engineering / Data` | group `tech` | a category only: the old answer cannot identify a specific job, so none is invented |
| `Product / PM` | group `tech` | "PM" is ambiguous (product/project), so no specific role is chosen |
| `Finance / Business` | group `bizfin` | |
| `Sales / Marketing` | group `sales` | |
| `Student` | `early.university_student` | unambiguous |
| `Other` | `other.other` | |
| the four emoji goal strings | their ids | and the string is still written back |
| the five confidence strings | themselves | they ARE the stored values |

Nothing is written to an existing profile until the learner edits something: `OnboardingCatalog.resolve()` is a pure read.

## 11. Review notes carried over
Overlapping rows (developer sub-roles, technician rows, customer-service vs call centre, the two researcher rows, goals that overlap situations) were **kept, not trimmed**, per the owner's decision; aliases make each findable from the other. Labels the review flagged as confusing were renamed by the owner: `phone_video_calls` and `academic_settings`. Still open for a future pass: sports, religious roles, aviation maintenance and legal secretary are reachable only through Other or search aliases.

