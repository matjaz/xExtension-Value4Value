<?php

class Value4ValueExtension extends Minz_Extension {

	const PODCAST_NAMESPACE = "https://podcastindex.org/namespace/1.0";

	protected array $csp_policies = [
		'connect-src' => '*',
	];

	/**
	 * @var array<SimplePie>
	 */
	private static $simplePie;

	public function init() {
		Minz_View::appendStyle($this->getFileUrl('style.css', 'css'));
		Minz_View::appendScript($this->getFileUrl('script.js', 'js'));

		$this->registerHook('simplepie_before_init', ['Value4ValueExtension', 'simplepieHook']);
		$this->registerHook('feed_before_insert', ['Value4ValueExtension', 'processInsertHook']);
		$this->registerHook('js_vars', ['Value4ValueExtension', 'jsVarsHook']);
	}

	/**
	 * @param SimplePie $simplePie
	 * @param FreshRSS_Feed $feed
	 */
	public static function simplepieHook($simplePie, $feed) {
		$id = spl_object_id($feed);
		self::$simplePie[$id] = $simplePie;
	}

	/**
	 * @param FreshRSS_Feed $feed
	 */
	public static function processInsertHook($feed) {
		$id = spl_object_id($feed);
		$simplePie = self::$simplePie[$id];
		$value = $simplePie->get_channel_tags(self::PODCAST_NAMESPACE, 'value');
		if ($value && $value[0]) {
			$attrs = $value[0]['attribs'][''];
			$type = $attrs['type'];
			$method = $attrs['method'];
			$valueRecipients = $value[0]['child'][self::PODCAST_NAMESPACE]['valueRecipient'];
			if ($type === 'lightning' && isset($valueRecipients)) {
				$allRecipients = array_map(fn ($recipient) => $recipient['attribs'][''], $valueRecipients);
				// support for keysend & Lightning address (LUD-16)
				$recipients = array_filter($allRecipients, fn ($recipient) => $recipient['type'] === 'node' || $recipient['type'] === 'lnaddress');
				if (count($recipients)) {
					$value4value = [
						'type' => $type,
						'method' => $method,
						'recipients' => $recipients,
					];
					$feed->_attribute('value4value', $value4value);
				}
			}
		}
		return $feed;
	}

	public static function jsVarsHook($jsVars) {
		$feedDAO = FreshRSS_Factory::createFeedDao();
		$feeds = $feedDAO->listFeeds();
		$feedsValue4Value = [];
		foreach ($feeds as $feed) {
			$Value4Value = $feed->attributeArray('value4value');
			if ($Value4Value) {
				$feedsValue4Value[$feed->id()] = $Value4Value;
			}
		}
		$jsVars['value4value'] = ['feeds' => $feedsValue4Value];
		return $jsVars;
	}
}
