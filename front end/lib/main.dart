import 'package:flutter/material.dart';
import 'screens/splash_screen.dart';
import 'screens/questionnaire_screen.dart';
import 'screens/recommendation_screen.dart';
import 'screens/optimized_route_screen.dart';
import 'screens/itinerary_screen.dart';

void main() {
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Tourism Planner',
      initialRoute: '/',
      routes: {
        '/': (_) => const SplashScreen(),
        '/questionnaire': (_) => const QuestionnaireScreen(),
        '/recommendation': (_) => const RecommendationScreen(),
        '/optimized': (_) => const OptimizedRouteScreen(),
        '/itinerary': (_) => const ItineraryScreen(),
      },
    );
  }
}
