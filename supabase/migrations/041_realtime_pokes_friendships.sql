-- Enable realtime for pokes and friendships so the app can listen for new pokes and friend requests
ALTER PUBLICATION supabase_realtime ADD TABLE pokes;
ALTER PUBLICATION supabase_realtime ADD TABLE friendships;
