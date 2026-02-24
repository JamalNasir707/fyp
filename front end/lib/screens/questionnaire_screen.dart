import 'package:flutter/material.dart';

class QuestionnaireScreen extends StatefulWidget {
  const QuestionnaireScreen({super.key});
  @override
  State<QuestionnaireScreen> createState() => _QuestionnaireScreenState();
}

class _QuestionnaireScreenState extends State<QuestionnaireScreen> {
  double budget = 1000;
  int days = 3;
  final interests = <String>['Museums', 'Parks', 'Food', 'Shopping', 'Culture'];
  final selected = <String>{};
  String travelStyle = 'Balanced';
  final styles = <String>['Relaxed', 'Balanced', 'Aggressive'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Questionnaire')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('Budget'),
            Slider(
              value: budget,
              min: 100,
              max: 5000,
              divisions: 49,
              label: budget.toStringAsFixed(0),
              onChanged: (v) => setState(() => budget = v),
            ),
            const SizedBox(height: 12),
            const Text('Days'),
            Row(
              children: [
                IconButton(
                  onPressed: () => setState(() => days = days > 1 ? days - 1 : 1),
                  icon: const Icon(Icons.remove),
                ),
                Text(days.toString()),
                IconButton(
                  onPressed: () => setState(() => days++),
                  icon: const Icon(Icons.add),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Interests'),
            Wrap(
              spacing: 8,
              children: interests
                  .map((i) => FilterChip(
                        label: Text(i),
                        selected: selected.contains(i),
                        onSelected: (s) {
                          setState(() {
                            if (s) {
                              selected.add(i);
                            } else {
                              selected.remove(i);
                            }
                          });
                        },
                      ))
                  .toList(),
            ),
            const SizedBox(height: 12),
            const Text('Travel style'),
            DropdownButton<String>(
              value: travelStyle,
              isExpanded: true,
              items: styles.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
              onChanged: (v) => setState(() => travelStyle = v ?? travelStyle),
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: () {
                  Navigator.pushNamed(context, '/recommendation');
                },
                child: const Text('Find My Plan'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
