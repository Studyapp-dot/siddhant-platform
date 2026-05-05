**ORIGIN**  
<br/>I am 4<sup>th</sup> year law student from Delhi India , currently doing my BA LLB from USLLS,GGSIPU.  
I have registered for the Legal wiki Startup Competition 2026 and is participating in it which is going to held on 28-29 March 2026 virtually.  
So I was thinking about my startup, what should I do. Though immediate event is the competition , but I want to build a proper Startup worthy of Startup name, sincerely.  
<br/>My personal experience became base for my startup. Before registering for the competition, I was studying my law subjects through Gemini Deep Research Reports. You can search the web to get info about it.  
<br/>First we have to Select Deep Research Tool on Gemini Consumer website. Then user gives query – after that it generates a Plan which we can approve or edit. After approving, it searches through web and create Report.  
The Reports were Good and very readable – they were also very updated with latest developments – so there were some plus points.  
But I found some inherent limitations that’s why on average I had to create 3 reports to get one proper report on a topic . So Readed:created ratio was 1:3 due to some reasons mentioned below  
<br/>1\. If the Query is Broad – then it did not explain all sections properly and compressed explanations creating anxiety whether something is missed or I am lacking proper understanding/nuances  
<br/>2\. If the Query is narrow – Then multiple reports were created with overlapping content – so I have to study more reports to cover a topic with significant overlapping content.  
<br/>In either cases there was worry am I missing something.  
<br/>Now coming back to the startup – I wanted to do something for average people more than lawyers. In India many people are afraid of law and related things like Police I hope I could change that. My inclination is usually more on the greater good and removal of sufferings from people who are grieved. Also I have this view that law applies on everyone then everyone should be able to understand law and apply it – everyone person especially in democracies like India. I do not feel complete reliance on lawyers is necessary and I doubt whether they are even needed in many contexts like simple cases – I hope you get the idea- even though I am a law student myself and is going to be advocate,but before that I am a human.  
<br/>So Initially I thought to make law accessible to masses – literally everyone who want to study in convenient way. But then I realised it is too broad, first we need to focus on narrow subset. There are many law students in india – in lakhs who like me come form middle class backgrounds- so they are too representative of masses-they do not become adversary just by choosing law as their profession. Also there is less friction since these law students are actively or are supposed to understand law than say a farmer or a tech company employee who are busy in their own affairs.  
<br/>Law students etc ( majority of advocates too) do not have desirable access to quality education and are not competent enough. At least I feel like it – Studious students may sort out their way but definitely more can be done.  
If I talk about myself and what I observe – Students read from famous books like MP Jain , Lexis Nexis and other famous commentaries. These commentaries are dense and span thousand of pages. I think not many are able to complete them and studies from internet or AI and very often Goal is to pass the exams and not everyone have good teachers and environment like NLUs.  
<br/>And I would be honest here. I am very socially anxious student and I have zero friends and social access – I don’t even talk or cant talk to anyone in my college. My reason for socially anxious is being skinny and my looks overall. I don’t even participate in any moots etc – so I think my observations are tainted due to my personal situation. But even when I try to think objectively according to my belief about general environment and other students they study from famous commentaries which are static and dense – more on this later . Gemini reports despite having some problems have some advantage over books like they mention the latest developments, case laws and are very readable but can lack depth and detail.  
It is important to note that famous book other than being static can also have errors For ex. I found one critical error about US court Judgement under BNS section 270 in KD Gaur book.  
Also when I ask good AI Models like Gemini 3 Pro to rate both book ( relevant parts like a particular topic) and reports – 90% of the time reports scored better than books.  
<br/>So my Initial idea was based on reports + Plus additional things. I thought to publish or simply add reports of various topics on a website but crucially they would be verified by a Human. So removing the fear of “AI Can make mistakes” which is written on every AI consumer website and I thought to use put most of them behind Paywall – with some reports provided for free.  
<br/>Rationale was this about Value addition  
<br/>1\. Most user are not aware of Gemini Deep Research  
2\. Even if someone Knew they may not be comfortable or open to it.  
3\. To generate Good reports – One needs to Prompt hard and filter out Good Reports from Compressed and Overlapping content reports. I made special Prompts to fix compressed and overlapping reports even these prompts were not 100% accurate.  
4\. And the major part – The ANXIETY from which I myself suffered that “Am I missing something” or “Am I reading which is not required” all the time. The Human Verification part was thought to solve exactly this with Human making edits/modifications also if required.  
<br/>(Note that this was the initial plan – it does not represent current state. )  
<br/><br/><br/>So this was the overall idea.  
But I wished to create a better Deep research agent than Gemini – Using Gemini Deep research agent was feeling Void as it is generally available with nothing of my own.  
So I struggled to Make a Better deep research agent than Gemini using Antigravity ( Search web – it is like cursor from google). As I was fascinated by long reports made by gemini – I was fixated to make a agent which make long reports than Gemini ( Gemini Reports were usually max 21-22 pages long on Default Google doc Pages with 16 page as content and rest references. These were the longest reports I got and I got shorter than this many times. Also I was fascinated by Gemini deep research reports as it can go upto 16 pages content which is coherent while normal chat usually give 3-4 pages responses especially on Gemini – So I saw it as amazing thing which broken Chat limits and which is just amazing to have 20 pages good content – so all this cause me to get fixated to get longer reports than gemini )  
<br/>I gave too many request to create such agent – Focus was on Exhaustiveness so we get longer reports- to Claude models on Google Antigravity. And I think I got one – it was actually simple  
<br/>\- Layer 1 Api call to AI models Generated draft  
\- Layer 2 do Draft Criticism  
then we Improved draft based on criticism – A separate call was made to AI to give improved parts based on criticism which we applied to Draft. As we were losing word count when we were giving AI both Criticism and Draft and asking it to Give complete Improved report. So we divided this task to 2 API calls. If I understood right ( I am non technical guy with no knowledge of coding and system/Product design) First API call was telling was telling what need to replaced and with what – second was applying it and does not need to improve on its own.  
<br/>\- Even after that we made several checks  
like Indian law check  
Case law check  
Counter Argument Check  
<br/>and used the same technique mentioned above to avoid losing word count .  
So finally I got longer reports than Gemini – like around 20-21 Pages of content with no references. As we achieved longer reports – my obsession from making longer reports began to wane.  
<br/>Reports made by this model were some pages longer than Gemini Reports content – But it has no references. But the biggest drawback ,which I realised after its completion was that the Report content was coming entirely from Model Training data – a huge disadvantage than Gemini DR ( Deep Research) which used web research and gave latest data. Hallucination, half baked content and errors were also the major problems. But I realized all this after agent was completed and wasted requests on both Antigravity and Openrouter. You can search about openrouter if you are not aware of it.  
<br/>So Next task which I could think of was to integrate web search.  
We tried to integrate DuckDuckGo and Jina reader in the same architecture , but the result were far from Good. Probable reasons are DuckDuckGo search substandard quality.  
Then I chatted with Claude and Gemini and got to Know Research agents are based on observe-think-act-repeat loop. So I asked Antigravity , using Claude opus 4.6 model to reconstruct our agent with this concept – React Loop – leading. But by then I think something sinister has happened with code and Antigravity was not able to do this properly.  
I pushed through Multiple prompts but still there was not enough progress – maybe we suffered from agent preexisting layered structure – It was difficult to completely overhaul the the existing code to make it React first. All of this then made me slightly frustrated.  
<br/>Then I again went to chatting with Claude, Gemini etc. and got to know most proprietary  
Deep research agents are Multi agent based on think-act-observe-repeat loop with tools like web search instead of a single agent. So I tried to Understand Multi agent architecture though chatting and draw my own multiagent on paper and confirmed it with AI again.  
They proposed some tiny changes and I updated my understanding based on feedback but all AI models largely approved my drawing of multi agent architecture.  
<br/>Here is the Partner summary created by Gemini of Multi agent architecture I drew  
<br/>\--------------------------------------------- SUMMARY ----------------------------------------------------------  
<br/>**Hey! Here is the breakdown of the multi-agent AI architecture we are building for the legal researcher.**

I’ve mapped out how the whole system will flow. Since we are building this for law students, the biggest thing we have to avoid is the AI hallucinating fake case laws or rules. So, I designed it with a strict "Research First, Draft Second" setup.

Every single agent in this system runs on a loop: **Thought-Act-Observe-Repeat.** They keep looping until their specific job is done.

Here is the lineup of our agents and what they actually do:

**1\. The Orchestrator (The Manager)**

This is the brain of the app. It takes the user’s query, but it does _not_ write the answer from memory. Instead, it creates a game plan and delegates tasks to the other agents. It passes the document around and stitches the final output together.

**2\. Discovery & RAG Agent (The Paralegal)**

Triggered first by the Orchestrator. Its only job is to go into our trusted databases, pull the actual text of bare acts, commentaries, and case laws, and hand a "Fact & Law Packet" back to the team.

**3\. The Drafting Agent (The Writer)**

Takes all that raw legal data from the Discovery Agent and writes the very first draft. This ensures every sentence is backed up by actual research, not AI guesses.

**4\. Citation Deep-Dive Agent (Our Secret Weapon)**

You know how textbooks like LexisNexis will just drop a citation in a footnote instead of explaining a crucial concept? This agent specifically hunts for those in our draft. It takes the cited case, uses its tools to go read the actual source material (like the headnote or ratio), and expands our draft to properly explain the concept.

**5\. Synthesis Agent (The Structurer)**

Instead of just "dumbing down" the law (which ruins the nuance), this agent takes heavy, dense paragraphs and structures them so they are easy for students to read—like breaking them into "The General Rule," "The Exceptions," and "Judicial Interpretation."

**6\. Missing Section Agent (The QA Checker)**

Reads the almost-finished draft and compares it to the user's original question to make sure we didn't miss any arguments or leave anything half-answered.

**7\. Update Agent (The Fact Checker)**

Does one last web/database search to make sure the laws or cases we cited haven't been recently overturned and are totally up to date.

  
\----------------------------------------------------SUMMARY END-------------------------------------------------  
<br/>You can see from the Summary that My focus was on Problems which I personally encounter when I study books and commentaries – So I thought to make a multi agent in which I would give book text (not verbatim to avoid copyright problems) which would solve all of these problems  
<br/>\- Some parts are dense  
\- Books are static and lack latest developments  
\- Some concepts are explained in Citations, not in Book itself  
\- Anxiety that I am missing content or nuance from other books  
<br/>So You can see My focus was on exhaustiveness and longer reports.  
<br/>As my existing agent code became messy- I thought to create multi agent architecture from scratch. But before that I create a Deep research Prompt from Gemini on Query on the lines “ Tell me How Gemini DR works and I want to create a better Research Agent than Gemini DR”. And then the Report Changed everything.  
<br/>I forgot to tell you before generating this report I tried a new way to make my agent. Instead of querying on web and then reading pages – I tried to send query on Google Gemini API with Google grounding on – so Google Grounding did the work for us, searching web and reading pages and then giving Response to our query. Rationale was the students need to learn prompting and send multiple prompts to AI to get all responses and then it is also headache to organize all those responses in clean and coherent way. So, our value was only saving student time and making and sending prompts for them and getting responses and organizing into a report. We are also likely to ask questions which a student may not but it is important. This was our only value addition – asking Questions, getting responses and organizing hence replacing student work and time otherwise technology remain same – all users have access to same Google Grounding on Gemini website as we have through API – hence it was less satisfying to me personally  
<br/>But this too did not work out well , most likely due to  
<br/>\- Gemini Grounding is only available through google and only on gemini models.  
Using cheap models like Gemini 2.5 flash lite gave very low quality responses – It was not answering the question decisively and found conflicting sources. Better models are costly  
and even Gemini Grounding cost is separate and very High. We cant use Better models due to cost but better models with Gemini Grounding are available freely on Google Webiste and Google AI studio for free- making me Question our Perceived value. Plus redundancy problem between different Query responses and even in Final report remained. Same thing was mentioned multiple times. Hence Reports were far from Good and I wasted so many credits on Openrouter and Antigravity request again. Now lets come to Report again I made to understand Gemini DR with the objective to make better agent than it. I understood I cant solely depend on AI and need to do my own application of mind and make decisions- that’s why I drew multiagent architecture and now this report , and it proved to be Game changing.  
<br/>**STEP – DR**  
<br/>Though I created the report to understand how Gemini DR works and make a better agent than gemini – I found something else much useful.  
There I read about Step Deep research which was mentioned in very few lines.  
I searched web and found Github of Single Agent Architecture based on Step Deep research and it uses Step 3.5 Falsh model – a Chinese Open source model which is internally trained for Deep Research Task so we do not need to Create a multi agent web .  
<br/>I downloaded Github and Replaced its search with Tavily which charges 0.008 Dollars per search and Translated Chinese prompts to English. Also Step 3.5 Flash is even cheaper than Gemini 2.5 Flash lite.  
Most Importantly The Agent is Creating Better Reports especially when it comes to Follow up reports AND gap filling reports – where Gemini Failed miserably – Gemini DR created follow up reports with overlapping content and struggled following instructions which were not straightforward and this is not the case with Step Deep Research.  
<br/>So Finally We have Deep Research Agent without Writing Code. You can see the importance of Deep Research reports – without them I was wasting credits and time on Antigravity.  
<br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>**Platform Design**  
<br/><br/>Since I have realised the Importance of Reports and Research before doing on my own without any Knowledge or rationale. I decided to design platform and double check the idea itself with research Reports.  
<br/>First Report regarding this , I made with Gemini DR  
I am pasting the Query as it is – You can see the Query as it mentions my thoughts and directions where I was/want/would move. Please see the Query as It would give you more info which I have not mentioned  
<br/>\---------------------------------------------------------**QUERY** -------------------------------------------------------  
“PLAN (Abstraction)

What I have

Step - Deep Research Agent integrated with Tavily (0.008$ per search). ( Check web its Chinese and open source)

Model - Step 3.5 Flash (Open Router)

It is Generating Good Reports

I have made some Reports on topics like BNS sections, Code on Social Security, 2020 and one of Daily Legal news

Context

I am participating in a Legal startup competition. so I need an idea

Before registering with this competition I was studying law for my exams through Deep Research Reports created by Gemini Deep Research

I found them very useful and a good source for studying. So I thought to make my startup around it, with larger motive and goal in mind that good legal education and making it accessible would be goal for my startup

I did not decide to solely depend on Reports made by AI web Agents My original and overall thought was that these Reports would be verified by humans having expertise, and then published on my platform (thus removing the fear of "AI can mistake" and make mental peace that these are verified by human)

Also, I thought these reports would not be static like books, and would be frequently updated based on feedback and developments, and hence law students would not be just consumers but active participants.

Also, as told above Reports would be updated for ex., a New case law relevant to a particular Report.

So what would Law students get :

Ready Reports (They can also make these Reports for other agents but that require manual work and prompting)

Above that, Reports would be verified by a HUMAN and frequently updated and I am still deciding

whether they should be exhaustive or not.

How Reports would be made?

As I told earlier I studied from Gemini Deep Research Reports, and from this only this idea came.

But from every 3 Reports I made, I studied from only 1 Report. That happens because I struggle to fix the subject of Report.

Big Domain / Topic -> compressed Report -> Not Everything Explained Properly

Small Domain / Topic -> Too many Reports -> Overlap with other Reports

Plus constant worry am I missing something, Reading which I should not, or not Reading which I should.

So I wished I had a better agent than a Gemini Deep Research and also something of my own.

So After doing so many ignorant things and hit and trial, I came to know about Step - Deep Research. It is open source and single agent unlike Gemini DR or other famous Deep Research Agents because Step Deep Research uses Step 3.5 flash which is internally trained for DR and hence do not need External Multi agent maze structure.

Also this is open source, we can tweak it if needed and make it suitable for our needs and it even have multi agent architecture, if need in future.

But right now, even with single Agent it is making reports at par with Gemini Deep Research on average (Sometimes it is better, sometimes not).

I am not thinking to make changes in code right now as it working well for now.

Now I need to think How do I use(MAXIMUM) this agent to achieve our goal and motive.

I have no business and Product sense still Here it is what I think

our platform Goal is to help Provide Best Legal Education to all Law students in India (in Lakhs)

But the Platform should not be static, it should be Dynamic and students should have a lot of say and feel platform as of their own.

This is my mind think what we should do to achieve this (Note - I have no product or business sense)

Also I heard, we should think not in events but in abstraction and I think most of my ideas come from my personal background of Social Anxiety. I have severe Social Anxiety - I do not speak and have 0 friends (I aim to change that though) still I am stating them

Should Reports made by us be exhaustive so students would not need to see other sources. We can achieve this to good extent by using / Referring Famous books while making Reports, Updating them and by Human Verification.

Student can suggest modifications, edits etc. There should be incentive for that.

As we want to feel student feel the platform as their own and feel the community

There should be incentive for

Students sharing their Notes, Class Notes content (NLU Notes!) etc.

Students Providing Guidance to Other Students

Students sharing their resources

Initially I thought not to give access to agent to students as I did not have one and if i had they were costly

Now I have "Step-DR" which uses Step 3.5 flash model (not too much costly)

Tavily Search (0.008$ per search)

But still it cost money and as a law student I cant give free access

I want to make maximum use of our agent

I made a Legal news Report and Today it gave a good Report, it may give a good Report on case analysis too - we would use specialized Prompts

I dont like Gatekeeping, both Justified or Non Justified.

Justified Gate-keeping (based on skill) I want our platform to help student in Skill Building And then HELP PROVIDE OR ACCESS TO All kind of opportunities to Everyone

We can also have study Buddy or Partner feature - or meaningful contact b/w students though I am not sure about it.

Law Students may also write their own opinion, and discuss things, so to build a community thing.

Just tell me Can this business work ?  
<br/><br/>\-----------------------------------------------------QUERY END------------------------------------------------------  
<br/><br/>Before Giving Summary I want to tell – This was the last report I made with Gemini DR regrading this topic. As Gemini was not following my Instruction Properly when I tried to make follow up reports by attaching the first report and want to expand only on some Points from the first report or from the Research Plan Gemini gave before starting research. Most frustrating was it was assuming I want to make or design my platform for socially anxious students but i never said I want to add features specifically for socially anxious students - I said I heard Decisions should be taken from Objective standpoint not personal standpoint and I felt my decisions about some features may be coming from my background - So i wanted to have a check on that. Also it reports felt like word salad – looks coherent from above but lack substance and utility or anything substantial. Still I am mentioning Summary from the above report  
<br/><br/>\------------------------------------------------------SUMMARY------------------------------------------------------  
<br/>The proposed AI-powered EdTech platform for Indian law students is highly viable and scalable. It generates dynamic, exhaustive legal research reports on niche topics using public-domain primary sources (Supreme Court judgments, Bare Acts, government reports) and verifies them through human editors. Integrated with a community repository of “NLU Notes” and gamified peer features, it directly closes the massive information gap between elite National Law Universities and the 1,500+ ordinary law colleges, while addressing students’ anxiety over outdated textbooks and AI hallucinations.

The chosen tech stack—Step 3.5 Flash model via OpenRouter plus Tavily Research API—delivers frontier-level reasoning at ultra-low cost: roughly ₹14.62 to produce a raw 5,000–6,000-word report and only ₹140 after human verification. This enables micro-transaction pricing (₹49–₹199) that perfectly matches the post-2022 EdTech shift toward affordable, bite-sized learning in a market projected to reach $29–33 billion by 2030–34.

The single existential requirement is a strict pivot away from summarising any copyrighted textbooks or commercial commentaries, as Indian Fair Dealing law (Section 52) prohibits commercial substitutes. By synthesising only public-domain materials and adding substantive human editorial input, the platform creates legally protectable assets, complies with DPDPA privacy rules, and avoids Bar Council of India conflicts by positioning itself purely as supplementary study aids.

A freemium token economy rewards students for uploading notes and participating, solving the cold-start problem organically while removing payment barriers for price-sensitive users. It occupies a clear white space—narrative synthesis plus continuous updates—without directly competing against LawSikho (high-ticket courses), LiveLaw (news), or CaseMine (raw databases).

In short, with the copyright pivot, substantive HITL process, and community tokenomics in place, the startup is not only feasible but positioned to democratise premium legal education, achieve strong unit economics, and capture significant market share in India’s evolving EdTech landscape.

\-------------------------------------------------------SUMMARY END----------------------------------------------  
<br/><br/><br/>I tried to create and created another report like a critique report of above report with Gemini DR – also on community design but I did not found them much useful especially because it was assuming I want to make design for socially anxious students  
<br/><br/>Now I am sharing Both Query and Report I made for actual Platform design from Step Deep research  
<br/>\--------------------------------------------------------QUERY--------------------------------------------------------  
<br/>This is my business Intro 

\-------------------------------------------------

PLAN (Abstraction)

What I have

Step - Deep Research Agent integrated with Tavily (0.008$ per search). ( Check web its Chinese and open source)

Model - Step 3.5 Flash (Open Router)

It is Generating Good Reports

I have made some Reports on topics like BNS sections, Code on Social Security, 2020 and one of Daily Legal news

Context

I am participating in a Legal startup competition. so I need an idea

Before registering with this competition I was studying law for my exams through Deep Research Reports created by Gemini Deep Research

I found them very useful and a good source for studying. So I thought to make my startup around it, with larger motive and goal in mind that good legal education and making it accessible would be goal for my startup

I did not decide to solely depend on Reports made by AI web Agents My original and overall thought was that these Reports would be verified by humans having expertise, and then published on my platform (thus removing the fear of "AI can mistake" and make mental peace that these are verified by human)

Also, I thought  these reports would not be static like books, and would be frequently updated based on feedback and developments, and hence law students would not be just consumers but active participants.

Also, as told above Reports would be updated for ex., a New case law relevant to a particular Report.

So what would Law students get :

Ready Reports (They can also make these Reports for other agents but that require manual work and prompting)

Above that, Reports would be verified by a HUMAN and frequently updated and I am still deciding

whether they should be exhaustive or not.

How Reports would be made?

As I told earlier I studied from Gemini Deep Research Reports, and from this only this idea came.

But from every 3 Reports I made, I studied from only 1 Report. That happens because I struggle to fix the subject of Report.

Big Domain / Topic -> compressed Report -> Not Everything Explained Properly

Small Domain / Topic -> Too many Reports -> Overlap with other Reports

Plus constant worry am I missing something, Reading which I should not, or not Reading which I should.

So I wished I had a better agent than a Gemini Deep Research and also something of my own.

So After doing so many ignorant things and hit and trial, I came to know about Step - Deep Research. It is open source and single agent unlike Gemini DR or other famous Deep Research Agents because Step Deep Research uses Step 3.5 flash which is internally trained for DR and hence do not need External Multi agent maze structure.

Also this is open source, we can tweak it if needed and make it suitable for our needs and it even  have multi agent architecture, if need in future.

But right now, even with single Agent it is making reports at par with Gemini Deep Research on average (Sometimes it is better, sometimes not).

I am not thinking to make changes in code right now as it working well for now.

Now I need to think How do I use(MAXIMUM) this agent to achieve our goal and motive.

I have no business and Product sense still Here it is what I think

our platform Goal is to help Provide Best Legal Education to all Law students in India (in Lakhs)

But the Platform should not be static, it should be Dynamic and students should have a lot of say and feel platform as of their own.

This is my mind think what we should do to achieve this (Note - I have no product or business sense)

Also I heard, we should think not in events but in abstraction and I think most of my ideas come from my personal background of social anxiety ) still I am stating them

Should Reports made by us be exhaustive so students would not need to see other sources. We can achieve this to good extent by using / Referring Famous books while making Reports, Updating them and by Human Verification.

Student can suggest modifications, edits etc. There should be incentive for that.

As we want to feel student feel the platform as their own and feel the community

There should be incentive for

Students sharing their Notes, Class Notes content (NLU Notes!) etc.

Students Providing Guidance to Other Students

Students sharing their resources

Initially I thought not to give access to agent to students as I did not have one and if i had they were costly

Now I have "Step-DR" which uses Step 3.5 flash model (not too much costly)

Tavily Search (0.008$ per search)

But still it cost money and as a law student I cant give free access

I want to make maximum use of our agent

I made a Legal news Report and Today it gave a good Report, it may give a good Report on case analysis too - we would use specialized Prompts

I dont like Gatekeeping, both Justified or Non Justified.

Justified Gate-keeping (based on skill) I want our platform to help student in Skill Building And then HELP PROVIDE OR ACCESS TO All kind of opportunities to Everyone

We can also have study Buddy or Partner feature - or meaningful contact b/w students though I am not sure about it.

Law Students may also write their own opinion, and discuss things, so to build a community thing.

I need help designing the EXACT PRODUCT 

\----------------------------

I have made one Scrutiny report 

It assumed I proposed Features for Socially Anxious students - My Point was Much broad

I said I heard Decisions should be taken from Objective standpoint not personal standpoint and I felt my decisions about some features may be coming from my background - So i wanted to have a check on that

like these points "Should Reports made by us be exhaustive so students would not need to see other sources. 

Student can suggest modifications, edits etc. There should be incentive for that.

As we want to feel student feel the platform as their own and feel the community

There should be incentive for

Students sharing their Notes, Class Notes content (NLU Notes!) etc.

Students Providing Guidance to Other Students

Students sharing their resources

Initially I thought not to give access to agent to students as I did not have one and if i had they were costly"

So create a report on should we have these and other community features ? Restrict to this area only - I want to Research about best community features objectively  
<br/>\-----------------------------------------------------------QUERY END ----------------------------------------------  
<br/>\-----------------------------------------------------------REPORT-----------------------------------------------------  
<br/><br/><br/><br/><br/><br/><br/><br/><br/><br/>