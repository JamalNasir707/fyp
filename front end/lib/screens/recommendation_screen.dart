import 'package:flutter/material.dart';

class RecommendationScreen extends StatefulWidget {
  const RecommendationScreen({super.key});
  @override
  State<RecommendationScreen> createState() => _RecommendationScreenState();
}

class _RecommendationScreenState extends State<RecommendationScreen> {
  final items = List.generate(8, (i) => 'Attraction ${i + 1}');
  final included = <int, bool>{};

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Recommendations')),
      body: ListView.builder(
        itemCount: items.length,
        itemBuilder: (context, index) {
          final name = items[index];
          final inc = included[index] ?? true;
          return Card(
            margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            child: ListTile(
              title: Text(name),
              subtitle: const Text('Match score • Est. cost'),
              trailing: Checkbox(
                value: inc,
                onChanged: (v) => setState(() => included[index] = v ?? inc),
              ),
            ),
          );
        },
      ),
      bottomNavigationBar: Padding(
        padding: const EdgeInsets.all(12),
        child: SizedBox(
          height: 48,
          child: ElevatedButton(
            onPressed: () {
              Navigator.pushNamed(context, '/optimized');
            },
            child: const Text('Generate Optimized Plan'),
          ),
        ),
      ),
    );
  }
}
