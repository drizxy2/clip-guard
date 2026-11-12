const badgeKey = "alertCounts";

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== "CLIP_GUARD_ALERT" || !Number.isInteger(sender.tab?.id)) return;
  const tabId = sender.tab.id;
  chrome.storage.session.get(badgeKey).then((value) => {
    const counts = value[badgeKey] || {};
    counts[tabId] = (counts[tabId] || 0) + 1;
    return chrome.storage.session.set({ [badgeKey]: counts }).then(() =>
      chrome.action.setBadgeText({ tabId, text: String(counts[tabId]) })
    );
  }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  chrome.storage.session.get(badgeKey).then((value) => {
    const counts = value[badgeKey] || {};
    delete counts[tabId];
    return chrome.storage.session.set({ [badgeKey]: counts });
  }).catch(() => {});
});
