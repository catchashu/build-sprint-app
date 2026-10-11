\#\# 2\. How we work  
\- Read IDEA\_SCOPE.md, PRODUCT.md, PLAN.md and PROGRESS.md before anything else, and DESIGN.md before any screen work.  
\- Before writing code, tell me in two or three sentences what you think I'm after, then your plan. Wait for my yes. Don't guess.  
\- One milestone at a time: the next one in PLAN.md, working end to end. Nothing outside it.  
\- If I ask for something new mid-milestone, add it to the parked list in PLAN.md and carry on.  
\- Never say "done" until you've seen it work (a test, or a screenshot at phone width) and told me how to check it on my phone.  
\- When I report a bug, find the cause before changing anything. Fix only that.  
\- When we add something new, write tests so what already works doesn't break. When I drop a feature, drop its tests.  
\- Build and test only in \[where my users will use it: WhatsApp, the web, ...\]. No web test page for a product that lives somewhere else.  
\- After I confirm a milestone works: commit, push, and add one line to PROGRESS.md.  
\- Never put a key or password in code, in a VITE\_ variable (those are sent to every visitor) or in a committed file.  
\- \[a rule of your own: anything you've had to say twice\]  
