import 'dart:async';
import '../models/place_model.dart';
import '../models/itinerary_model.dart';

class ApiService {
  Future<List<Place>> fetchRecommendations() async {
    await Future.delayed(const Duration(milliseconds: 300));
    return List.generate(
      6,
      (i) => Place(
        id: 'p$i',
        name: 'Place ${i + 1}',
        latitude: 0,
        longitude: 0,
        cost: 20 + i * 5,
        matchScore: 0.6 + i * 0.05,
      ),
    );
  }

  Future<List<DayPlan>> optimizeRoute(List<Place> included) async {
    await Future.delayed(const Duration(milliseconds: 600));
    return [
      DayPlan(dayNumber: 1, places: included.take(3).toList()),
      DayPlan(dayNumber: 2, places: included.skip(3).take(3).toList()),
    ];
  }
}
