import re

with open('screens/DashboardScreen.js', 'r') as f:
    content = f.read()

# Fix 1: Replace single fetch with pagination loop
old = "        fetch(`${BASE_URL}/tasksite/?page_size=200`, { headers }),"
new = """        (async () => {
          let allTasks = [];
          let page = 1;
          let hasMore = true;
          while (hasMore) {
            const r = await fetch(`${BASE_URL}/tasksite/?page=${page}`, { headers });
            if (!r.ok) break;
            const d = await r.json();
            const results = Array.isArray(d) ? d : (d.results || []);
            allTasks = [...allTasks, ...results];
            console.log(`[Tasks] page ${page}: ${results.length} items, total: ${allTasks.length}`);
            hasMore = !!d.next;
            page += 1;
            if (page > 20) break;
          }
          return { _allTasks: allTasks };
        })(),"""

if old in content:
    content = content.replace(old, new)
    print("Fix 1 applied: pagination loop added")
else:
    print("Fix 1 NOT found - checking line 185...")
    lines = content.split('\n')
    print("Line 185:", lines[184])

# Fix 2: Update the handler to use _allTasks
old2 = """      if (tasksRes.ok) {
        const d = await tasksRes.json();
        const taskList = Array.isArray(d) ? d : (d.results || []);
        console.log('[Tasks] total:', taskList.length, 'statuses:', [...new Set(taskList.map(t => t.status))]);
        setTasks(taskList);
      }"""

new2 = """      if (tasksRes && tasksRes._allTasks) {
        const taskList = tasksRes._allTasks;
        console.log('[Tasks] total:', taskList.length, 'statuses:', [...new Set(taskList.map(t => t.status))]);
        setTasks(taskList);
      }"""

if old2 in content:
    content = content.replace(old2, new2)
    print("Fix 2 applied: handler updated")
else:
    print("Fix 2 NOT found - searching for handler...")
    idx = content.find('tasksRes.ok')
    if idx > -1:
        print("Found tasksRes.ok at:", idx)
        print(content[idx-10:idx+200])

with open('screens/DashboardScreen.js', 'w') as f:
    f.write(content)
print("Done!")
