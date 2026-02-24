import 'place_model.dart';

class DayPlan {
  final int dayNumber;
  final List<Place> places;
  const DayPlan({required this.dayNumber, required this.places});
  factory DayPlan.fromJson(Map<String, dynamic> j) => DayPlan(
        dayNumber: j['dayNumber'] as int,
        places: (j['places'] as List)
            .map((e) => Place.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
  Map<String, dynamic> toJson() => {
    'dayNumber': dayNumber,
    'places': places.map((e) => e.toJson()).toList(),
  };
}
