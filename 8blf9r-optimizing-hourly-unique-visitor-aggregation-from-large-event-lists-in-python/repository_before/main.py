def aggregate_hourly_unique_visitors(events):
    # events is list of dicts: {'timestamp': datetime, 'page_url': str, 'visitor_id': str, ...}
    result = {}
    for event in events:
        hour_key = event['timestamp'].strftime('%Y-%m-%d %H:00')
        page = event['page_url']
        visitor = event['visitor_id']
        if hour_key not in result:
            result[hour_key] = {}
        if page not in result[hour_key]:
            result[hour_key][page] = set()
        result[hour_key][page].add(visitor)
    # Convert sets to counts
    final = {}
    for hour, pages in result.items():
        final[hour] = {}
        for page, visitors in pages.items():
            final[hour][page] = len(visitors)
    return final