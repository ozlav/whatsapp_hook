the goal of this web server is to liston to webhook calls coming from EvolutionAPI for whatsapp 
listen to messages coming from a specific group id ( remotejid)
then read the unstractured message 
pass it to openai llm using langgraph with a simple system prompt 
the respnse should be only a  structured json according to a provided schema in schema.json file 
then based on the response create a record in the google sheet defined 



##the logic of message handling 
Step 1: Message Evaluation

Relevant Message

A message is considered relevant if it contains enough information to populate most of the schema fields — specifically:

All required fields, or at least the following minimum:

work_id 

address

phone

If no specific work id defined , address can be the work id. 

If a message meets these criteria, proceed to message parsing.

Reply Message Handling

If the message is identified as a reply within a thread:

Retrieve the previois message.

Check whether the prev message contain  a work id.

If a work order exists in the thread:

Perform an update operation based on any new or changed data in the reply.

Irrelevant Message Handling

If a message (and its prev, in case of a reply) does not contain any work order information,

Skip  the message  handling 
Every message should be added to the Log sheet 



Message Parsing: 
message should be parsed using openai LLM and json response mode 
response should be according to the json schema 
if values are missing in the message, add empty string. 

Update to google sheet:
once new message is parsed  -  add a new row in the deposite sheet 
one a replay mesage is parsed  -  update the relevant field in the relevant row according to the work id 

Whatsapp Group to be parsed 
 * const targetGroupId = env.TARGET_GROUP_ID || '120363418663151479@g.us'; 
