import 'package:flutter/material.dart';

class ItineraryScreen extends StatelessWidget {
  const ItineraryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final days = [
      {
        'day': 1,
        'items': ['09:00 – Attraction A', '12:00 – Attraction B', '15:30 – Attraction C']
      },
      {
        'day': 2,
        'items': ['09:30 – Attraction D', '13:00 – Attraction E']
      },
    ];
    return Scaffold(
      appBar: AppBar(title: const Text('Itinerary')),
      body: ListView(
        padding: const EdgeInsets.all(12),
        children: [
          for (final d in days)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Day ${d['day']}', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    for (final s in (d['items'] as List<String>)) Text(s),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
