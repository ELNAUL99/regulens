// Hand-curated subset of the EU AI Act (Regulation 2024/1689). Plain-English
// summaries of the binding articles, sufficient for the regression cases.
// Each chunk is one retrievable unit; verbatim quotes are encouraged when LLMs
// cite them but the agent will instead cite article_id + annex_point.

export type SeedChunk = {
  article_id: string;
  title: string;
  annex_point?: string;
  content: string;
  source_type?: string; // 'regulation' (default) | 'guidance' | 'national' | 'commentary'
};

export const CORPUS_SEED: SeedChunk[] = [
  {
    article_id: "Art. 3",
    title: "Definitions",
    content:
      "Defines key terms used in the Regulation. 'AI system' means a machine-based system designed to operate with varying levels of autonomy, that may exhibit adaptiveness after deployment and that, for explicit or implicit objectives, infers, from the input it receives, how to generate outputs such as predictions, content, recommendations or decisions that can influence physical or virtual environments. 'Provider' means a natural or legal person, public authority, agency or other body that develops an AI system or a general-purpose AI model or that has an AI system or a general-purpose AI model developed and places it on the market or puts the system into service under its own name or trademark. 'Deployer' means any natural or legal person, public authority, agency or other body using an AI system under its authority except where the AI system is used in the course of a personal non-professional activity. 'Placing on the market', 'putting into service', 'making available on the market', 'biometric data', 'biometric identification', 'biometric categorisation', 'emotion recognition system', 'remote biometric identification system', 'real-time remote biometric identification system', 'critical infrastructure', 'safety component' are also defined here.",
  },
  {
    article_id: "Art. 5",
    title: "Prohibited AI practices",
    content:
      "Article 5 prohibits the placing on the market, putting into service or use of AI systems that: (a) deploy subliminal techniques beyond a person's consciousness or purposefully manipulative or deceptive techniques with the objective or effect of materially distorting behaviour and causing significant harm; (b) exploit vulnerabilities of a natural person or specific group due to age, disability or specific social or economic situation in a way that causes or is reasonably likely to cause significant harm; (c) carry out social scoring by public authorities or on their behalf evaluating or classifying natural persons over time on the basis of social behaviour or known/predicted personality characteristics, where the social score leads to detrimental or unfavourable treatment that is unrelated to the contexts in which the data was originally generated, or unjustified/disproportionate; (d) make risk assessments of natural persons in order to assess or predict the risk of a natural person committing a criminal offence, based solely on profiling or personality traits (predictive policing on individuals); (e) create or expand facial recognition databases through untargeted scraping of facial images from the internet or CCTV; (f) infer emotions of a natural person in the areas of workplace and education institutions, except for medical or safety reasons; (g) biometric categorisation systems that categorise individuals based on biometric data to deduce or infer race, political opinions, trade union membership, religious or philosophical beliefs, sex life or sexual orientation; (h) real-time remote biometric identification in publicly accessible spaces for law enforcement, subject to narrow exceptions and prior judicial authorisation.",
  },
  {
    article_id: "Art. 6",
    title: "Classification rules for high-risk AI systems",
    content:
      "An AI system is classified as high-risk if (1) it is intended to be used as a safety component of a product, or is itself a product, covered by the Union harmonisation legislation listed in Annex I, AND that product is required to undergo a third-party conformity assessment; OR (2) the AI system is referred to in Annex III. Article 6(3) provides a derogation: an Annex III system is NOT high-risk if it does not pose a significant risk of harm to the health, safety or fundamental rights of natural persons, including by not materially influencing the outcome of decision-making — for example where the AI system is intended to perform a narrow procedural task, improve the result of a previously completed human activity, detect decision-making patterns without replacing or influencing the previously completed human assessment without proper human review, or perform a preparatory task. The derogation does not apply where the AI system performs profiling of natural persons.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "1",
    content:
      "Annex III point 1 — Biometrics, insofar as their use is permitted under relevant Union or national law: (a) Remote biometric identification systems (excluding biometric verification confirming identity of a specific natural person); (b) AI systems intended for biometric categorisation according to sensitive or protected attributes or characteristics based on inference of those attributes; (c) AI systems intended for emotion recognition.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "2",
    content:
      "Annex III point 2 — Critical infrastructure: AI systems intended to be used as safety components in the management and operation of critical digital infrastructure, road traffic, or the supply of water, gas, heating and electricity.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "3",
    content:
      "Annex III point 3 — Education and vocational training: (a) AI systems intended to determine access, admission or assignment of natural persons to educational and vocational training institutions at all levels; (b) AI systems intended to evaluate learning outcomes, including when those outcomes are used to steer the learning process; (c) AI systems intended to assess the appropriate level of education that an individual will receive or will be able to access; (d) AI systems intended for monitoring and detecting prohibited behaviour of students during tests.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "4",
    content:
      "Annex III point 4 — Employment, workers management and access to self-employment: (a) AI systems intended for recruitment or selection of natural persons, in particular to place targeted job advertisements, analyse and filter job applications, and evaluate candidates; (b) AI systems intended to make decisions affecting terms of work-related relationships, the promotion or termination of work-related contractual relationships, to allocate tasks based on individual behaviour or personal traits or characteristics, or to monitor and evaluate the performance and behaviour of persons in such relationships.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "5",
    content:
      "Annex III point 5 — Access to and enjoyment of essential private and public services: (a) AI systems intended to be used by public authorities or on their behalf to evaluate eligibility for essential public assistance benefits and services, including healthcare services, as well as to grant, reduce, revoke, or reclaim such benefits and services; (b) AI systems intended to evaluate the creditworthiness of natural persons or establish their credit score, with the exception of AI systems used for the purpose of detecting financial fraud; (c) AI systems intended for risk assessment and pricing in relation to natural persons in the case of life and health insurance; (d) AI systems intended to evaluate and classify emergency calls or to be used to dispatch or to establish priority in the dispatching of emergency first response services.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "6",
    content:
      "Annex III point 6 — Law enforcement: AI systems used by or on behalf of law enforcement authorities for (a) assessing the risk of a natural person becoming a victim of criminal offences; (b) polygraphs and similar tools; (c) evaluating the reliability of evidence in the course of investigation or prosecution; (d) assessing the risk of a natural person re-offending or recidivism risk, not solely based on profiling under Article 5; (e) profiling of natural persons in the course of detection, investigation or prosecution of criminal offences.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "7",
    content:
      "Annex III point 7 — Migration, asylum and border control management: AI systems intended for use by or on behalf of competent public authorities for polygraphs and similar tools; assessing risks (including security risk, irregular migration risk, or health risk) posed by a natural person who intends to enter or has entered the territory of a Member State; assisting in examination of applications for asylum, visa and residence permits; for the purpose of detecting, recognising or identifying natural persons in the context of migration, asylum and border control management.",
  },
  {
    article_id: "Annex III",
    title: "High-risk AI systems referred to in Article 6(2)",
    annex_point: "8",
    content:
      "Annex III point 8 — Administration of justice and democratic processes: (a) AI systems intended to be used by a judicial authority or on their behalf to assist a judicial authority in researching and interpreting facts and the law and in applying the law to a concrete set of facts, or to be used in a similar way in alternative dispute resolution; (b) AI systems intended to be used for influencing the outcome of an election or referendum or the voting behaviour of natural persons in the exercise of their vote.",
  },
  {
    article_id: "Art. 25",
    title: "Responsibilities along the AI value chain",
    content:
      "Article 25 governs reassignment of obligations along the AI value chain. Any distributor, importer, deployer or other third party shall be considered to be a provider of a high-risk AI system for the purposes of this Regulation and shall be subject to the obligations of the provider under Article 16 in any of the following circumstances: (a) they put their name or trademark on a high-risk AI system already placed on the market or put into service, without prejudice to contractual arrangements stipulating that the obligations are otherwise allocated; (b) they make a substantial modification to a high-risk AI system that has already been placed on the market or put into service in such a way that it remains a high-risk AI system pursuant to Article 6; (c) they modify the intended purpose of an AI system, including a general-purpose AI system, which has not been classified as high-risk and has already been placed on the market or put into service in such a way that the AI system concerned becomes a high-risk AI system in accordance with Article 6.",
  },
  {
    article_id: "Art. 26",
    title: "Obligations of deployers of high-risk AI systems",
    content:
      "Article 26 sets the deployer's duties: take appropriate technical and organisational measures to ensure use in accordance with instructions; assign human oversight to natural persons with the necessary competence, training, authority and support; ensure that input data is relevant and sufficiently representative; monitor the operation of the system on the basis of the instructions for use and inform the provider of serious incidents and risks; keep automatically generated logs for an appropriate period of at least six months; before putting into service or using a high-risk AI system at the workplace, inform workers' representatives and the affected workers; where applicable, use the information provided under Article 13 to carry out a Data Protection Impact Assessment (DPIA); cooperate with competent authorities. Deployers of high-risk AI systems referred to in Annex III that make decisions or assist in making decisions related to natural persons shall inform the natural persons that they are subject to the use of the high-risk AI system. Public-authority and certain private deployers must carry out a Fundamental Rights Impact Assessment under Article 27.",
  },
  {
    article_id: "Art. 27",
    title: "Fundamental rights impact assessment for high-risk AI systems (FRIA)",
    content:
      "Article 27 requires deployers that are bodies governed by public law, or private entities providing public services, and deployers of high-risk AI systems referred to in Annex III point 5(b) and 5(c) (creditworthiness/credit scoring and life/health insurance risk and pricing), to perform — prior to first deployment — a Fundamental Rights Impact Assessment (FRIA) describing: the deployer's processes in which the system will be used; the period of time and frequency of intended use; categories of natural persons and groups likely to be affected; specific risks of harm likely to impact those categories; measures of human oversight; measures to be taken in case those risks materialise, including governance and complaint-handling arrangements. The deployer shall notify the market surveillance authority of the results.",
  },
  {
    article_id: "Art. 50",
    title: "Transparency obligations for providers and deployers of certain AI systems",
    content:
      "Article 50 sets transparency duties that apply regardless of risk classification. Providers shall ensure that AI systems intended to interact directly with natural persons are designed and developed in such a way that the natural persons concerned are informed that they are interacting with an AI system, unless this is obvious from the perspective of a reasonably well-informed, observant and circumspect natural person. Providers of AI systems, including general-purpose AI systems, generating synthetic audio, image, video or text content shall ensure that the outputs of the AI system are marked in a machine-readable format and detectable as artificially generated or manipulated. Deployers of an emotion recognition system or a biometric categorisation system shall inform the natural persons exposed thereto of the operation of the system. Deployers of an AI system that generates or manipulates image, audio or video content constituting a deep fake shall disclose that the content has been artificially generated or manipulated. Deployers of an AI system that generates or manipulates text published with the purpose of informing the public on matters of public interest shall disclose that the text has been artificially generated or manipulated, unless human review or editorial responsibility is in place.",
  },
  {
    article_id: "Art. 86",
    title: "Right to explanation of individual decision-making",
    content:
      "Article 86 grants any affected person subject to a decision which is taken by the deployer on the basis of the output from a high-risk AI system listed in Annex III (with the exception of systems listed under point 2 — critical infrastructure) and which produces legal effects or similarly significantly affects them in a way they consider to adversely impact their health, safety or fundamental rights, the right to obtain from the deployer clear and meaningful explanations of the role of the AI system in the decision-making procedure and the main elements of the decision taken. This right applies without prejudice to Article 22 GDPR.",
  },
  // ----- Commission guidance (non-binding interpretive material) -----
  {
    article_id: "Commission Guidelines (Art. 5)",
    title: "Guidelines on prohibited AI practices (C(2025) 884)",
    source_type: "guidance",
    content:
      "Commission Guidelines on prohibited AI practices clarify the scope of Article 5. Key points: (i) 'subliminal techniques' covers stimuli below conscious awareness AND purposefully manipulative or deceptive techniques whose effect a reasonable person would not foresee; (ii) 'significant harm' includes physical, psychological, financial and economic harm, assessed cumulatively across affected persons; (iii) the social-scoring prohibition (Art. 5(1)(c)) covers private actors acting 'on behalf of' public authorities, not only public bodies; (iv) the workplace/education emotion-inference prohibition (Art. 5(1)(f)) covers both employees and candidates during recruitment, and applies regardless of whether inference is the primary or a secondary purpose; (v) 'biometric categorisation' (Art. 5(1)(g)) is interpreted broadly and is not limited to facial data; (vi) real-time remote biometric identification (Art. 5(1)(h)) covers airport security and transport-hub deployments operated by private operators acting in cooperation with law-enforcement authorities; one-to-one verification is excluded.",
  },
  {
    article_id: "Commission Guidelines (Art. 3(1))",
    title: "Guidelines on the definition of an AI system (C(2025) 924)",
    source_type: "guidance",
    content:
      "Commission Guidelines on the definition of an 'AI system' under Article 3(1) clarify the seven cumulative elements: (1) machine-based, (2) designed to operate with varying levels of autonomy, (3) may exhibit adaptiveness after deployment, (4) explicit or implicit objectives, (5) inference capability — distinguishing AI from purely deterministic software, (6) outputs (predictions, content, recommendations, decisions), (7) ability to influence physical or virtual environments. Systems based solely on rules defined by natural persons to automatically execute operations are EXCLUDED. Basic data-processing systems, classical heuristics, and simple prediction systems based on statistical learning rules with limited inference capability may fall outside the definition. Recital 12 is the controlling interpretive aid.",
  },
  {
    article_id: "Commission Guidance — High-risk classification",
    title: "Practical guidance on Annex III and Article 6(3) derogation",
    source_type: "guidance",
    content:
      "Practical guidance on Article 6 high-risk classification: when an Annex III use is identified, the provider must conduct and document an Article 6(3) derogation analysis BEFORE concluding the system is not high-risk. Derogation requires that the system performs only a narrow procedural task, improves a previously completed human activity, detects decision-making patterns without replacing the human assessment, or performs preparatory work. Profiling of natural persons CANNOT benefit from the derogation. The provider must register the derogation in the EU database (Art. 49(2)) and keep documentation available for market surveillance.",
  },
  {
    article_id: "GPAI Code of Practice",
    title: "General-Purpose AI Code of Practice (transparency & copyright chapters)",
    source_type: "guidance",
    content:
      "The voluntary GPAI Code of Practice operationalises Articles 53–55 for general-purpose AI model providers. Transparency chapter: maintain an up-to-date model documentation form covering training data sources, compute, energy use, evaluations, and downstream-provider information. Copyright chapter: implement a policy to comply with Union copyright law, including respecting machine-readable opt-outs under Article 4(3) of the DSM Directive (2019/790), and providing a sufficiently detailed summary of training content. Models meeting the systemic-risk threshold (Art. 51) face additional model-evaluation, incident-reporting and cybersecurity duties.",
  },
  {
    article_id: "Art. 53",
    title: "Obligations for providers of general-purpose AI models",
    source_type: "regulation",
    content:
      "Article 53 requires providers of general-purpose AI models to: (a) draw up and keep up-to-date technical documentation of the model including training and testing process and evaluation results; (b) draw up, keep up-to-date and make available information and documentation to downstream providers that intend to integrate the GPAI model into their AI systems; (c) put in place a policy to comply with Union copyright law, including identifying and complying with reservations of rights pursuant to Article 4(3) of Directive (EU) 2019/790; (d) draw up and make publicly available a sufficiently detailed summary about the content used for training of the general-purpose AI model. Free and open-source models that do not present systemic risk are exempt from (a) and (b).",
  },
  {
    article_id: "Art. 4",
    title: "AI literacy",
    source_type: "regulation",
    content:
      "Article 4 requires providers and deployers of AI systems to take measures to ensure, to their best extent, a sufficient level of AI literacy of their staff and other persons dealing with the operation and use of AI systems on their behalf, taking into account technical knowledge, experience, education, training and the context in which the AI systems are to be used.",
  },
  {
    article_id: "Art. 49",
    title: "Registration in the EU database",
    source_type: "regulation",
    content:
      "Article 49 requires providers (and certain deployers that are public authorities or EU bodies) of high-risk AI systems referred to in Annex III to register the system in the EU database before placing it on the market or putting it into service. Providers that conclude under Article 6(3) that their Annex III system is not high-risk must also register that conclusion together with documentation justifying the derogation.",
  },
  // ----- Finnish national implementation context -----
  {
    article_id: "Traficom — national AI Act guidance",
    title: "Traficom: national supervisory context for the EU AI Act in Finland",
    source_type: "national",
    content:
      "The Finnish Transport and Communications Agency (Traficom) is one of the national bodies supporting AI Act implementation in Finland. Traficom's published material explains how the Regulation applies in Finland, signposts the national contact points for market surveillance of high-risk AI systems in the transport and communications sectors, and points operators to the EU AI Act Service Desk and the AI Office for cross-border questions. Operators placing high-risk AI systems on the Finnish market should monitor Traficom's guidance for sector-specific notification, registration and incident-reporting procedures, in addition to the EU-level obligations under Articles 49 and 73.",
  },
  {
    article_id: "TEM — Finnish AI Act implementation",
    title: "Ministry of Economic Affairs and Employment (TEM): national implementation of the EU AI Act",
    source_type: "national",
    content:
      "The Finnish Ministry of Economic Affairs and Employment (TEM) leads the national implementation of the EU AI Act (Regulation 2024/1689) in Finland. TEM coordinates the designation of the national competent authority, the notifying authority and the market surveillance authorities required by Articles 70 and 74 of the Regulation. Finnish providers and deployers should expect a national act complementing the Regulation, designating the supervisory architecture and any national administrative fines. Until the national act is in force, the directly applicable obligations of the Regulation already bind providers and deployers in Finland according to the staged application dates (Art. 113).",
  },
  {
    article_id: "Valtioneuvosto — TEM044:00/2024",
    title: "Government project TEM044:00/2024 — preparing Finnish AI Act legislation",
    source_type: "national",
    content:
      "Valtioneuvosto (the Finnish Government) project TEM044:00/2024 tracks the legislative work to adapt Finnish law to the EU AI Act, including designating supervisory authorities, allocating market surveillance responsibilities across sectors (Traficom, FIN-FSA, Valvira, the Data Protection Ombudsman, etc.), and setting the national rules on sanctions. The project page is the authoritative source for the current status of the Finnish implementing act and for any consultation documents that may affect providers and deployers operating in Finland.",
  },
];

/** Regression cases referenced by the playbook. */
export const REGRESSION_SEED = [
  {
    name: "RC1 — Live emotion recognition in classrooms",
    description: "Provider deploys real-time emotion recognition cameras in EU primary schools to assess pupil engagement.",
    input:
      "Our SaaS product 'EngageEd' uses live camera feeds in EU primary school classrooms to infer pupil emotions (happy, confused, distracted) in real time and shows teachers an attention dashboard. We sell it to school districts.",
    expected_art5_banner: { triggered: true, letter: "f" },
    expected_risk_tier: "prohibited",
    expected_annex_point: null,
    expected_role: "provider",
  },
  {
    name: "RC2 — CV-screening recruitment tool",
    description: "Provider builds a CV screening tool for HR teams.",
    input:
      "We're building 'HireSift', an LLM-powered tool that ranks and filters job applications for corporate HR teams in the EU. It scores each CV and recommends a shortlist.",
    expected_art5_banner: { triggered: false },
    expected_risk_tier: "high",
    expected_annex_point: "Annex III §4",
    expected_role: "provider",
  },
  {
    name: "RC3 — Generative chatbot for marketing copy",
    description: "Deployer fine-tunes a general-purpose model to produce marketing copy.",
    input:
      "We use GPT-4 via an API to generate marketing emails and social media posts for our SME customers. No personal data of end users is processed beyond the customer's own brand assets.",
    expected_art5_banner: { triggered: false },
    expected_risk_tier: "limited",
    expected_annex_point: null,
    expected_role: "deployer",
  },
  {
    name: "RC4 — Credit scoring API for consumer lenders",
    description: "Provider sells a credit-scoring model to EU consumer lenders.",
    input:
      "Our company offers 'CreditIQ', an ML model API that returns a 0-1000 creditworthiness score for natural persons. EU consumer lenders integrate it into their loan-approval flow.",
    expected_art5_banner: { triggered: false },
    expected_risk_tier: "high",
    expected_annex_point: "Annex III §5(b)",
    expected_role: "provider",
  },
];