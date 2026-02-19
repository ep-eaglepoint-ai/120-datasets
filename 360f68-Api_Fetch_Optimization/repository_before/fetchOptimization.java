public static List<Object> fetchItems(List<Object> items) {
    List<Object> result = new ArrayList<>();
    for (int i = 0; i < items.size(); i++) {
        if (!result.contains(items.get(i))) {
            result.add(items.get(i));
        }
    }
    return result;
}
