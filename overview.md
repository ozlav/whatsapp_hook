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

If a message meets these criteria, proceed to message parsing.

Reply Message Handling

If the message is identified as a reply within a thread:

Retrieve the entire thread.

Check whether the thread contains a work order.

If a work order exists in the thread:

Perform an update operation based on any new or changed data in the reply.

Irrelevant Message Handling

If a message (and its thread, in case of a reply) does not contain any work order information,

Ignore the message and skip further processing.