'use strict';

window.addEventListener('load', function(){
	const { feeds } = window.context.extensions.value4value;
	if (feeds) {

		function LNUrlp(lnAddress) {
			const parts = lnAddress.split('@')
			return `https://${parts[1]}/.well-known/lnurlp/${parts[0]}`;
		}

		async function fetchLNUrlp(lnAddress) {
			const url = LNUrlp(lnAddress);
			const r = await fetch(url);
			if (r.ok) {
				const data = await r.json();
				if (data && data.callback) {
					return data;
				}
			}
		}

		async function fetchInvoice(lnAddress, amount) {
			const data = await fetchLNUrlp(lnAddress);
			if (data) {
				const { callback, commentAllowed } = data;
				let url = data.callback + (callback.includes('?') ? '&' : '?') + `amount=${1000 * amount}`;
				if (commentAllowed > 0) {
					const comment = prompt("Enter message to post author");
					if (comment) {
						if (comment.length > commentAllowed) {
							alert("Message is too long.");
							return;
						}
						url += '&comment=' + encodeURIComponent(comment);
					}
				}
				const r = await fetch(url);
				if (r.ok) {
					const data = await r.json();
					if (data) {
						return data.pr;
					}
				}
			}
		}

		async function payLNAddr(lnAddress, satsAmount) {
			try {
				const invoice = await fetchInvoice(lnAddress, satsAmount);
				if (invoice) {
					return window.webln.sendPayment(invoice);
				}
			} catch (e) {
				console.error(e);
			}
		}

		async function payKeysend(recipient, amount) {
			try {
				const customRecords = {};
				if (recipient.customValue) {
					customRecords[recipient.customKey] = recipient.customValue;
				}
				console.log(recipient, customRecords);
				return window.webln.keysend({
					amount,
					customRecords,
					destination: recipient.address,
				});
			} catch (e) {
				console.error(e);
			}
		}

		Object.keys(feeds).forEach(function(feedId) {
			const payFeed = async function() {
				const { webln } = window;
				if (webln) {
					const feed = feeds[feedId];
					const amount = feed.suggested ? parseFloat(feed.suggested) * 1e8 : '1000';
					const totalAmount = prompt('Enter total amount in sats you would like to boost:', amount);
					if (totalAmount && Number.isInteger(parseInt(totalAmount, 10))) {
						const shares = {};
						const totalShares = feed.recipients.reduce((sum, r) => sum + r.split, 0);
						const payments = feed.recipients.map(r => {
							const amount = Math.floor(totalAmount * (r.split / totalShares));
							shares[r.address] = amount;
							return `${amount} sats to ${r.name}`;
						}).join('\n');
						if (feed.recipients.length > 1) {
							alert(`You are about to send Lightning payments to following addresses\n${payments}`);
						}
						try {
							await webln.enable();
						} catch (e) {}
						feed.recipients.forEach(async function(recipient) {
							const amount = shares[recipient.address];
							if (recipient.type === 'lnaddress') {
								const resp = await payLNAddr(recipient.address, amount);
								console.log(resp);
							} else {
								// recipient.type === 'node'
								const resp = await payKeysend(recipient, amount);
								console.log(resp);
							}
							const el = document.querySelector('.current .lightning-pay');
							if (el) {
								const origContent = el.innerHTML;
								el.innerHTML = '<div>Success</div>';
								setTimeout(() => {
									el.innerHTML = origContent;
								}, 1500);
							}
						});
					}
				} else {
					alert('Please install WebLN enabled wallet. We recommend getalby.com extension.');
				}
			};
			const feedItem = document.querySelectorAll(`div[data-feed="${feedId}"]`);
			feedItem.forEach(function(el) {
				const payEl = document.createElement('div');
				payEl.className = 'item-element lightning-pay';
				payEl.innerHTML = '<img class="icon" src="/ext.php?f=xExtension-Value4Value%2Fstatic%2Fln.svg&t=svg">Boost post';
				payEl.addEventListener('click', payFeed);
				el.querySelector('.item.share').appendChild(payEl);
			});
		});
	}
});
